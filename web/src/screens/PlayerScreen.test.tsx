import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadCredentials, saveCredentials } from '../net/credentials'
import { FakeWebSocket } from '../test/fakeWebSocket'
import { json, member, push, roomView, serve, shadowDuel, stubFetch } from '../test/fixtures'
import { PlayerScreen } from './PlayerScreen'

const me = { role: 'player', playerId: 1 } as const

describe('joining', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  it('looks the room up, takes a name and connects', async () => {
    stubFetch({
      'GET /api/rooms/BKTR': () =>
        json(200, {
          code: 'BKTR',
          status: 'lobby',
          players: 1,
          maxPlayers: 9,
          mode: 'killer_inspector',
        }),
      'POST /api/rooms/BKTR/players': () => json(201, { playerId: 2, playerToken: 'tok' }),
      'GET /api/modes': () => json(200, [shadowDuel]),
    })
    render(<PlayerScreen code="BKTR" />)
    expect(screen.getByRole('status')).toHaveTextContent('Looking up the room…')
    expect(await screen.findByText('1 player is waiting')).toBeInTheDocument()
    const join = screen.getByRole('button', { name: 'Join room' })
    expect(join).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), {
      target: { value: '  Bob ' },
    })
    fireEvent.click(join)
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
    expect(loadCredentials('BKTR', 'player')).toEqual({ token: 'tok', playerId: 2, clientSeq: 0 })
    expect(screen.getByRole('status')).toHaveTextContent('Connecting…')
  })

  it.each([
    [{ status: 'lobby', players: 0 }, 'No one has joined yet'],
    [
      { status: 'in_game', players: 2 },
      'A game is running in this room. You can join when it ends.',
    ],
  ])('says what the room is doing: %o', async (room, text) => {
    stubFetch({
      'GET /api/rooms/BKTR': () => json(200, { code: 'BKTR', maxPlayers: 9, mode: 'x', ...room }),
    })
    render(<PlayerScreen code="BKTR" />)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('explains a missing room and a refused join', async () => {
    stubFetch({
      'GET /api/rooms/BKTR': () => json(404, { error: 'room_not_found' }),
      'POST /api/rooms/BKTR/players': () => json(409, { error: 'name_taken' }),
    })
    const { unmount } = render(<PlayerScreen code="BKTR" />)
    expect(
      await screen.findByText('No room has the code BKTR. Check the code on the board.'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), {
      target: { value: 'Ann' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Join room' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Someone in this room already uses that name.',
    )
    unmount()
  })
})

describe('in the room', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    stubFetch({ 'GET /api/modes': () => json(200, [shadowDuel]) })
    saveCredentials('BKTR', 'player', { token: 'tok', playerId: 1, clientSeq: 0 })
  })

  async function enter(room = roomView(), you: { role: 'player'; playerId?: number } = me) {
    render(<PlayerScreen code="BKTR" />)
    expect(screen.getByRole('status')).toHaveTextContent('Connecting…')
    const ws = serve(you, { t: 'room', room })
    await screen.findByRole('switch') // the modes arrived
    return ws
  }

  it('lets the VIP run the lobby', async () => {
    const ws = await enter(
      roomView({
        members: [member(1, 'Ann'), member(2, 'Bob'), member(3, 'Cy')],
        hostConnected: false,
      }),
    )
    expect(
      screen.getByText("You're the VIP: you choose the game and start it."),
    ).toBeInTheDocument()
    expect(screen.getByText('The board screen is disconnected.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bob?' }))
    expect(ws.commands()).toEqual([
      { t: 'start', clientSeq: 1 },
      { t: 'kick', clientSeq: 2, playerId: 2 },
    ])
    push(
      ws,
      { t: 'rejected', clientSeq: 2, reason: 'wrong_status' },
      { t: 'error', code: 'server_error' },
    )
    expect(screen.getByText('That can’t be done right now.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
  })

  it('tells the VIP how many players are missing', async () => {
    await enter(roomView({ members: [member(1, 'Ann')] }))
    expect(screen.getByRole('button', { name: 'Needs 1 more player' })).toBeDisabled()
  })

  it('shows everyone else whom they are waiting for, and lets them leave', async () => {
    const ws = await enter(roomView({ vip: 2, members: [member(2, 'Bob'), member(1, 'Ann')] }))
    expect(screen.getByText('Waiting for Bob to start the game')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to leave' }))
    expect(ws.commands()).toEqual([{ t: 'leave', clientSeq: 1 }])
    act(() => ws.drop(1000))
    expect(screen.getByRole('heading', { name: 'You left room BKTR.' })).toBeInTheDocument()
    expect(loadCredentials('BKTR', 'player')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the start' }))
    expect(window.location.pathname).toBe('/')
  })

  it('follows the game: playing or watching, the end-game button, nudges', async () => {
    const ws = await enter()
    push(ws, { t: 'room', room: roomView({ status: 'in_game', round: 1, seats: [1, 2] }) })
    expect(screen.getByRole('heading', { name: 'Shadow Duel is on' })).toBeInTheDocument()
    expect(screen.getByText('You play in this round.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave room' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'End game' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to end it for everyone' }))
    expect(ws.commands()).toEqual([{ t: 'end_game', clientSeq: 1 }])
    push(
      ws,
      { t: 'nudge', event: {} },
      { t: 'room', room: roomView({ status: 'in_game', round: 1, seats: [2, 3], vip: 2 }) },
    )
    expect(screen.getByText('Time’s up for this turn.')).toBeInTheDocument()
    expect(screen.getByText('You’re watching this round.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'End game' })).toBeNull()
  })

  it('shows how a game ended and lets the VIP play again', async () => {
    const ws = await enter()
    push(ws, {
      t: 'room',
      room: roomView({
        status: 'finished',
        round: 1,
        lastResult: { round: 1, kind: 'finished' },
      }),
    })
    expect(screen.getByText('Case closed')).toBeInTheDocument()
    expect(screen.getByText('The game is over.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(ws.commands()).toEqual([{ t: 'play_again', clientSeq: 1 }])
    push(ws, { t: 'room', room: roomView({ status: 'finished', vip: 2 }) })
    expect(screen.getByText('Waiting for Bob to start the next round')).toBeInTheDocument()
  })

  it('says why everyone is back in the lobby when a game stopped early, but not after a normal finish', async () => {
    const ws = await enter()
    push(ws, {
      t: 'room',
      room: roomView({ round: 1, lastResult: { round: 1, kind: 'ended_by_host' } }),
    })
    expect(screen.getByText('The VIP ended the game.')).toBeInTheDocument()
    push(ws, {
      t: 'room',
      room: roomView({ round: 1, lastResult: { round: 1, kind: 'finished' } }),
    })
    expect(screen.queryByText('The game is over.')).toBeNull()
  })

  it('offers to join again after being removed', async () => {
    stubFetch({
      'GET /api/modes': () => json(200, [shadowDuel]),
      'GET /api/rooms/BKTR': () =>
        json(200, { code: 'BKTR', status: 'lobby', players: 1, maxPlayers: 9, mode: 'x' }),
    })
    const ws = await enter()
    act(() => ws.drop(4003))
    expect(
      screen.getByRole('heading', { name: 'You were removed from room BKTR.' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Join again' }))
    expect(await screen.findByRole('textbox', { name: 'Your name' })).toBeInTheDocument()
  })

  it('copes without its player number', async () => {
    await enter(roomView(), { role: 'player' })
    expect(screen.queryByText("You're the VIP: you choose the game and start it.")).toBeNull()
  })
})
