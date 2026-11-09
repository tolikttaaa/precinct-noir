import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ModeInfo } from '../protocol/generated'
import { member, roomView, shadowDuel } from '../test/fixtures'
import { ConnectionNotice, Flash, Masthead } from './Chrome'
import { ConfirmButton } from './ConfirmButton'
import { Lineup } from './Lineup'
import { playingIds } from './seats'
import { Link } from './Link'
import { QrCode } from './QrCode'
import { RoomRules } from './RoomRules'

describe('ConfirmButton', () => {
  it('needs a second tap, and forgets the first after a few seconds', () => {
    vi.useFakeTimers()
    const confirm = vi.fn()
    render(<ConfirmButton label="Leave" confirmLabel="Tap again" onConfirm={confirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(screen.getByRole('button', { name: 'Tap again' })).toHaveAttribute('data-armed', 'true')
    act(() => vi.advanceTimersByTime(4000))
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tap again' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Leave' })).not.toHaveAttribute('data-armed')
    vi.useRealTimers()
  })
})

describe('QrCode', () => {
  it('draws the code as a labelled image', () => {
    render(<QrCode value="https://precinct.example/BKTR" label="Scan to join" />)
    const qr = screen.getByRole('img', { name: 'Scan to join' })
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/)
  })
})

describe('Masthead', () => {
  it('switches the whole page between English and Russian, and has the sound', () => {
    render(<Masthead code="BKTR" />)
    expect(screen.getByRole('link', { name: 'Precinct Noir' })).toHaveAttribute('href', '/')
    expect(screen.getByText('BKTR')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Language: English' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Русский' }))
    expect(screen.getByRole('link', { name: 'Precinct Noir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Язык: Русский' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Звук' }))
    expect(screen.queryByRole('slider', { name: 'Музыка' })).toBeNull()
    expect(screen.getByRole('slider', { name: 'Эффекты' })).toBeInTheDocument()
  })

  it('can leave out the name, and adds the music where it plays', () => {
    render(<Masthead named={false} music />)
    expect(screen.queryByRole('link')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sound' }))
    expect(screen.getByRole('slider', { name: 'Music' })).toBeInTheDocument()
  })
})

describe('Link', () => {
  it('navigates in place on a plain click, and leaves modified clicks to the browser', () => {
    render(<Link to="/tv/BKTR">Board</Link>)
    const link = screen.getByRole('link', { name: 'Board' })
    fireEvent.click(link, { metaKey: true })
    expect(window.location.pathname).toBe('/')
    fireEvent.click(link)
    expect(window.location.pathname).toBe('/tv/BKTR')
  })
})

describe('ConnectionNotice and Flash', () => {
  it('show connection trouble only', () => {
    const { rerender } = render(<ConnectionNotice connection="reconnecting" />)
    expect(screen.getByRole('status')).toHaveTextContent('Connection lost. Reconnecting…')
    rerender(<ConnectionNotice connection="open" />)
    expect(screen.getByRole('status', { hidden: true })).not.toBeVisible()
  })

  it('show a message for a few seconds, and again for a new one', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Flash id={1} message="Not your turn" />)
    expect(screen.getByRole('status')).toHaveTextContent('Not your turn')
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByRole('status', { hidden: true })).not.toBeVisible()
    rerender(<Flash id={2} message="Too late" />)
    expect(screen.getByRole('status')).toHaveTextContent('Too late')
    rerender(<Flash id={3} />)
    expect(screen.getByRole('status', { hidden: true })).not.toBeVisible()
    vi.useRealTimers()
  })
})

describe('Lineup', () => {
  const members = [member(1, 'Ann'), member(2, 'Bob', false), member(3, 'Cy')]

  it('shows who plays and who watches, the VIP, you and who is offline', () => {
    const remove = vi.fn()
    render(
      <Lineup
        members={members}
        playing={playingIds(members, [], 2)}
        vip={1}
        you={1}
        mode={{ name: 'Shadow Duel', players: 2 }}
        onRemove={remove}
      />,
    )
    const [players, watchers] = screen.getAllByRole('list')
    expect(players).toHaveTextContent('AnnVIPYou')
    expect(players).toHaveTextContent('BobOffline')
    expect(watchers).toHaveTextContent('Cy')
    expect(
      screen.getByText('Shadow Duel takes 2 players. Everyone else watches this round.'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2) // not yourself
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Remove Cy?' }))
    expect(remove).toHaveBeenCalledWith(3)
  })

  it('takes the seats from a running game, and says when the room is empty', () => {
    expect([...playingIds(members, [3, 1], 2)]).toEqual([3, 1])
    render(<Lineup members={[]} playing={new Set()} mode={{ name: 'Shadow Duel', players: 2 }} />)
    expect(screen.getByText('No one has joined yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('RoomRules', () => {
  const ranged: ModeInfo = {
    id: 'future_mode',
    minPlayers: 3,
    maxPlayers: 9,
    config: { options: [{ t: 'range', key: 'rounds', min: 1, max: 3, default: 2 }] },
  }

  it('lets the VIP change the game, its rules and the timer', () => {
    const send = vi.fn()
    const { rerender } = render(
      <RoomRules
        room={roomView({ turnTimer: 90 })}
        modes={[shadowDuel, ranged]}
        editable
        send={send}
      />,
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'future_mode' },
    })
    fireEvent.click(screen.getByRole('switch', { name: 'Clues from the dead' }))
    fireEvent.click(screen.getByRole('radio', { name: '60 s' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Off' }))
    expect(screen.getByRole('radio', { name: '90 s' })).toBeChecked()
    expect(send.mock.calls.map(([c]) => c)).toEqual([
      { t: 'set_mode', mode: 'future_mode' },
      { t: 'set_config', config: { interrogateDeadOnBoard: false } },
      { t: 'set_timer', seconds: 60 },
      { t: 'set_timer' },
    ])

    send.mockClear()
    rerender(
      <RoomRules
        room={roomView({ mode: 'future_mode', config: {} })}
        modes={[shadowDuel, ranged]}
        editable
        send={send}
      />,
    )
    const rounds = screen.getByRole('combobox', { name: 'rounds' })
    expect(rounds).toHaveValue('2')
    fireEvent.change(rounds, { target: { value: '3' } })
    expect(send).toHaveBeenCalledWith({ t: 'set_config', config: { rounds: 3 } })
  })

  it('shows the rules read-only to everyone else, and copes with an unknown mode', () => {
    render(
      <RoomRules
        room={roomView({ mode: 'gone' })}
        modes={[shadowDuel]}
        editable={false}
        send={vi.fn()}
      />,
    )
    expect(screen.getByRole('combobox', { name: 'Game' })).toBeDisabled()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByRole('radio', { name: 'Off' })).toBeDisabled()
  })
})
