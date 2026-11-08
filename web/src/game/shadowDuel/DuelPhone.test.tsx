import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MeView, Opt, ShadowDuelEvent, ShadowDuelView } from '../../protocol/generated'
import { duelView, roomView } from '../../test/fixtures'
import { DuelPhone } from './DuelPhone'

// Ann (seat 0) is the killer as Gloria (12, the middle of the board); Bob (seat 1) is the inspector.
const killer: MeView = { seat: 0, role: 'killer', identity: 12, hand: [] }
const inspector: MeView = { seat: 1, role: 'inspector', identity: 0, hand: [3, 4, 5] }
const room = roomView({ status: 'in_game', round: 1, seats: [1, 2] })
const shiftRow1: Opt = {
  t: 'shift',
  action: 'shift',
  moves: [
    { line: { axis: 'row', index: 0 }, by: 1 },
    { line: { axis: 'row', index: 0 }, by: -1 },
  ],
}

function phone(view: ShadowDuelView, legal: Opt[] = [], events: ShadowDuelEvent[] = []) {
  const send = vi.fn()
  const ui = (refusalId: number, v = view) => (
    <DuelPhone
      room={{ ...room, status: v.outcome ? 'finished' : 'in_game' }}
      duel={{ view: v, legal, events }}
      send={send}
      refusalId={refusalId}
      footer={<button type="button">End game</button>}
    />
  )
  const { rerender } = render(ui(0))
  return {
    send,
    refuse: (id: number) => rerender(ui(id)),
    update: (v: ShadowDuelView) => rerender(ui(0, v)),
  }
}

const bar = () => within(screen.getByRole('contentinfo'))
const sent = (choice: object, decisionId = 7) => ({ t: 'act', decisionId, choice })

describe('the killer’s phone', () => {
  it('opens on the first kill: pick a lit neighbour, confirm, then wait', () => {
    const view = duelView({
      me: killer,
      pending: { id: 7, actor: 0, kind: 'turn', prompt: 'opening_kill' },
    })
    const { send, refuse } = phone(view, [{ t: 'target', action: 'kill', targets: [6, 7] }])
    expect(screen.getByRole('status', { name: '' })).toBeDefined()
    expect(screen.getByText('Make the first kill.')).toBeInTheDocument()
    expect(bar().getByText('Tap a lit suspect to kill.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dorothy' }))
    fireEvent.click(bar().getByRole('button', { name: 'Kill Dorothy' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'target', action: 'kill', target: 6 }))
    expect(bar().getByText('Sent. Waiting for the board…')).toBeInTheDocument()
    refuse(1) // a refusal brings the controls back
    expect(bar().getByText('Tap a lit suspect to kill.')).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Cancel' }))
    fireEvent.click(bar().getByRole('button', { name: 'Kill' }))
    expect(screen.getByRole('button', { name: 'Duke' })).toBeInTheDocument()
  })

  it('shifts a row: tap an arrow, then confirm it', () => {
    const { send } = phone(duelView({ me: killer }), [
      shiftRow1,
      { t: 'target', action: 'kill', targets: [6] },
      { t: 'simple', action: 'disguise' },
    ])
    expect(screen.getByText('Your turn. Take one action.')).toBeInTheDocument()
    expect(
      bar().getByText('Or tap an arrow on the edge to slide a row or column.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shift row 2 right' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Shift row 1 left' }))
    fireEvent.click(screen.getByRole('button', { name: 'Shift row 1 right' }))
    expect(
      screen.getByRole('button', { name: 'Shift row 1 right', pressed: true }),
    ).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Shift row 1 right' }))
    expect(send).toHaveBeenCalledWith(
      sent({ t: 'shift', action: 'shift', line: { axis: 'row', index: 0 }, by: 1 }),
    )
  })

  it('explains a disguise before taking it', () => {
    const { send } = phone(duelView({ me: killer }), [{ t: 'simple', action: 'disguise' }])
    fireEvent.click(bar().getByRole('button', { name: 'Disguise' }))
    expect(bar().getByText(/^Draw a new identity/)).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Cancel' }))
    fireEvent.click(bar().getByRole('button', { name: 'Disguise' }))
    fireEvent.click(bar().getByRole('button', { name: 'Disguise' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'simple', action: 'disguise' }))
  })

  it('collapses the city: choose the way, then a body in each line that has several', () => {
    const { send } = phone(duelView({ me: killer }), [
      {
        t: 'collapse',
        action: 'collapse',
        options: [
          { direction: 'columns', lines: [[2], [7, 12]] },
          { direction: 'rows', lines: [[2], [7]] },
        ],
      },
    ])
    fireEvent.click(bar().getByRole('button', { name: 'Collapse' }))
    fireEvent.click(bar().getByRole('button', { name: 'Take a body from each column' }))
    expect(bar().getByText('Tap a lit body. 1 line still needs one.')).toBeInTheDocument()
    expect(bar().getByRole('button', { name: 'Collapse' })).toBeDisabled()
    expect(screen.getByRole('img', { name: 'Beatrice' }).closest('[data-chosen]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Duke' }))
    expect(bar().getByText('Ready: one body from each line.')).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Collapse' }))
    expect(send).toHaveBeenCalledWith(
      sent({ t: 'collapse', action: 'collapse', direction: 'columns', picks: [2, 7] }),
    )
  })

  it('collapses again or stops when the city still qualifies', () => {
    const view = duelView({
      me: killer,
      pending: { id: 9, actor: 0, kind: 'substep', prompt: 'collapse_more' },
    })
    const { send } = phone(view, [
      { t: 'collapse', action: 'collapse', options: [{ direction: 'rows', lines: [[3], [8]] }] },
      { t: 'simple', action: 'stop_collapsing' },
    ])
    expect(screen.getByText(/can close up again/)).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Collapse again' }))
    expect(bar().getByText('Ready: one body from each line.')).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Cancel' }))
    fireEvent.click(bar().getByRole('button', { name: 'Stop' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'simple', action: 'stop_collapsing' }, 9))
  })

  it('waits during the other player’s turn, with the room buttons out of the way', () => {
    phone(duelView({ me: killer, pending: { id: 8, actor: 1, kind: 'turn', prompt: 'turn' } }))
    expect(screen.getByText('Bob to move.')).toBeInTheDocument()
    expect(bar().queryByRole('button')).toBeNull()
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('button', { name: 'End game' }),
    )
  })
})

describe('the inspector’s phone', () => {
  it('picks an identity from the four drawn cards', () => {
    const view = duelView({
      me: { seat: 1, role: 'inspector', hand: [3, 4, 5, 6] },
      pending: { id: 7, actor: 1, kind: 'setup', prompt: 'choose_identity' },
    })
    const { send } = phone(view, [
      { t: 'pick', action: 'choose_identity', cards: [3, 4, 5, 6], min: 1, max: 1 },
    ])
    expect(screen.queryByRole('group', { name: 'The city' })).toBeNull()
    expect(bar().getByText('Tap a card to choose it.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bruno' }))
    fireEvent.click(bar().getByRole('button', { name: 'Be Bruno' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'pick', action: 'choose_identity', cards: [3] }))
  })

  it('accuses a neighbour, or clears a suspect', () => {
    const view = duelView({
      me: inspector,
      pending: { id: 7, actor: 1, kind: 'turn', prompt: 'turn' },
    })
    const { send } = phone(view, [
      { t: 'target', action: 'accuse', targets: [0, 1] },
      { t: 'simple', action: 'exonerate' },
    ])
    fireEvent.click(bar().getByRole('button', { name: 'Accuse' }))
    expect(bar().getByText('Tap a lit suspect to accuse.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abe' }))
    fireEvent.click(bar().getByRole('button', { name: 'Accuse Abe' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'target', action: 'accuse', target: 1 }))
  })
})

describe('the player’s file', () => {
  it('opens only while held, and lights up where you stand', () => {
    phone(duelView({ me: inspector, pending: undefined }))
    const file = screen.getByRole('button', { name: 'Your file: Hold to look' })
    expect(screen.getByText('You’re the inspector')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Ada, you' })).toBeNull()
    fireEvent.pointerDown(file)
    expect(file).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: 'Ada, you' })).toBeInTheDocument()
    expect(
      screen.getByText('You are Ada. Evidence in your hand: Bruno, Cora, Calvin.'),
    ).toBeInTheDocument()
    fireEvent.pointerUp(file)
    expect(screen.queryByRole('img', { name: 'Ada, you' })).toBeNull()
    fireEvent.pointerDown(file)
    fireEvent.pointerLeave(file)
    fireEvent.pointerDown(file)
    fireEvent.pointerCancel(file)
    expect(file).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens from the keyboard while Space or Enter is held', () => {
    phone(duelView({ me: killer }))
    const file = screen.getByRole('button', { name: 'Your file: Hold to look' })
    fireEvent.keyDown(file, { key: 'a' })
    expect(file).toHaveAttribute('aria-pressed', 'false')
    fireEvent.keyDown(file, { key: ' ' })
    expect(screen.getByText('You are Gloria.')).toBeInTheDocument()
    fireEvent.keyDown(file, { key: ' ', repeat: true })
    fireEvent.keyUp(file, { key: 'a' })
    expect(file).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyUp(file, { key: ' ' })
    expect(file).toHaveAttribute('aria-pressed', 'false')
    fireEvent.keyDown(file, { key: 'Enter' })
    fireEvent.blur(file)
    expect(file).toHaveAttribute('aria-pressed', 'false')
    expect(fireEvent.contextMenu(file)).toBe(false)
  })

  it('says when there is no identity yet', () => {
    phone(duelView({ me: { seat: 1, role: 'inspector', hand: [] }, pending: undefined }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Your file: Hold to look' }))
    expect(screen.getAllByText('You don’t have an identity yet.')).not.toHaveLength(0)
  })
})

describe('around the board', () => {
  it('shows the tally, the public case log, help and the walkthrough', () => {
    phone(
      duelView({ me: killer, kills: 2 }),
      [],
      [
        { t: 'your_identity', card: 12 },
        { t: 'killed', seat: 0, victim: 6, kills: 1 },
      ],
    )
    expect(screen.getByText('2 of 14')).toBeInTheDocument()
    expect(screen.getByText('Dorothy was killed.')).toBeInTheDocument()
    expect(screen.queryByText('You are Gloria.')).toBeNull()
    fireEvent.click(screen.getByText('What can I do now?'))
    expect(screen.getByText('Kill one of the suspects around you.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }))
    expect(screen.getByRole('heading', { name: 'How to play Shadow Duel' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the game' }))
    expect(screen.getByRole('group', { name: 'The city' })).toBeInTheDocument()
  })

  it('lets spectators follow along without controls or a file', () => {
    phone(duelView())
    expect(screen.getByText('You’re watching this round.')).toBeInTheDocument()
    expect(screen.getByText('Ann to move.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Your file/ })).toBeNull()
    expect(screen.queryByText('What can I do now?')).toBeNull()
  })

  it('ends with the verdict and everyone’s real identity', () => {
    phone(
      duelView({
        me: killer,
        pending: undefined,
        kills: 14,
        outcome: { winners: [0], reason: 'kill_quota' },
        reveal: {
          seats: [
            { seat: 0, role: 'killer', identity: 12, hand: [] },
            { seat: 1, role: 'inspector', hand: [3, 4] },
          ],
        },
      }),
    )
    expect(screen.getByRole('heading', { name: 'Case closed Ann wins' })).toBeInTheDocument()
    expect(screen.getByText('The killer reached 14 kills.')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Gloria' })).toHaveLength(2)
    expect(screen.getByText('No identity')).toBeInTheDocument()
    expect(screen.getByText('Hand: Bruno, Cora')).toBeInTheDocument()
    expect(bar().getByRole('button', { name: 'End game' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Your file/ })).toBeNull()
  })
})
