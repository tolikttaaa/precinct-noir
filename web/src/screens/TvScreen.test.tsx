import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadCredentials, saveCredentials } from '../net/credentials'
import { FakeWebSocket } from '../test/fakeWebSocket'
import { json, push, roomView, serve, shadowDuel, stubFetch } from '../test/fixtures'
import { TvScreen } from './TvScreen'

const host = { role: 'host' } as const

describe('TvScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    stubFetch({ 'GET /api/modes': () => json(200, [shadowDuel]) })
  })

  it('sends a screen that did not open the room to the join page', () => {
    render(<TvScreen code="BKTR" />)
    expect(
      screen.getByRole('heading', { name: 'This screen isn’t the board for room BKTR.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Join as a player' })).toHaveAttribute('href', '/BKTR')
  })

  it('shows the code, how to join and the line-up while people arrive', async () => {
    saveCredentials('BKTR', 'host', { token: 'h', clientSeq: 0 })
    render(<TvScreen code="BKTR" />)
    expect(screen.getByRole('status')).toHaveTextContent('Connecting…')
    const ws = serve(host, { t: 'room', room: roomView({ vip: undefined, members: [] }) })
    expect(ws.sent[0]).toEqual({ t: 'hello', room: 'BKTR', token: 'h' })
    expect(screen.getByText('BKTR', { selector: '.case-number' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Or point a phone camera here' })).toBeInTheDocument()
    expect(screen.getByText(`Join at ${window.location.host}/BKTR`)).toBeInTheDocument()
    expect(screen.getByText('Waiting for players to join')).toBeInTheDocument()

    push(ws, { t: 'room', room: roomView() })
    expect(await screen.findByText('Waiting for Ann to start the game')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shadow Duel' })).toBeInTheDocument()

    push(ws, { t: 'room', room: roomView({ status: 'in_game', round: 1, seats: [2, 1] }) })
    expect(screen.getByRole('heading', { name: 'Shadow Duel is on' })).toBeInTheDocument()
    expect(screen.queryByText('BKTR', { selector: '.case-number' })).toBeNull()

    push(ws, {
      t: 'room',
      room: roomView({ status: 'finished', round: 1, lastResult: { round: 1, kind: 'finished' } }),
    })
    expect(screen.getByText('The game is over.')).toBeInTheDocument()
    expect(screen.getByText('Waiting for Ann to start the next round')).toBeInTheDocument()

    push(ws, {
      t: 'room',
      room: roomView({ round: 2, lastResult: { round: 2, kind: 'idle_timeout' } }),
    })
    expect(screen.getByText('The game ended after two hours without a move.')).toBeInTheDocument()
  })

  it('offers a new room when this one closes', () => {
    saveCredentials('BKTR', 'host', { token: 'h', clientSeq: 0 })
    render(<TvScreen code="BKTR" />)
    act(() => FakeWebSocket.latest().drop(4004))
    expect(screen.getByRole('heading', { name: 'Room BKTR has closed.' })).toBeInTheDocument()
    expect(loadCredentials('BKTR', 'host')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open a new room' }))
    expect(window.location.pathname).toBe('/')
  })
})
