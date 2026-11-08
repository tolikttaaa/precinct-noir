import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

const tab = (name: string) => screen.getByRole('tab', { name })
const panel = () => within(screen.getByRole('tabpanel'))

describe('the killer’s phone', () => {
  it('opens on the first kill: the other actions say why they must wait', () => {
    const view = duelView({
      me: killer,
      pending: { id: 7, actor: 0, kind: 'turn', prompt: 'opening_kill' },
    })
    const { send, refuse } = phone(view, [{ t: 'target', action: 'kill', targets: [6, 7] }])
    expect(screen.getByText('Make the first kill.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Kill', selected: true })).toBeInTheDocument()
    expect(
      panel().getByText(/^Kill a living suspect in one of the eight tiles/),
    ).toBeInTheDocument()
    expect(bar().getByText('Tap a lit suspect to kill.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dorothy' }))
    fireEvent.click(bar().getByRole('button', { name: 'Kill Dorothy' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'target', action: 'kill', target: 6 }))
    expect(bar().getByText('Sent. Waiting for the board…')).toBeInTheDocument()
    refuse(1) // a refusal brings the controls back
    expect(bar().getByText('Tap a lit suspect to kill.')).toBeInTheDocument()
    for (const name of ['Disguise', 'Shift', 'Collapse']) {
      fireEvent.click(tab(name))
      expect(tab(name)).toHaveAttribute('data-off')
      expect(panel().getByText(/^Not on the first move/)).toBeInTheDocument()
      expect(bar().getByText('Choose an action above.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Dorothy' })).toBeNull()
    }
    fireEvent.click(tab('Kill'))
    expect(screen.getByRole('button', { name: 'Duke' })).toBeInTheDocument()
  })

  it('switches between actions without cancelling, and shifts a row by its arrow', () => {
    const { send } = phone(duelView({ me: killer }), [
      shiftRow1,
      { t: 'target', action: 'kill', targets: [6] },
      { t: 'simple', action: 'disguise' },
    ])
    expect(screen.getByText('Your turn. Take one action.')).toBeInTheDocument()
    // The turn opens on Shift: no one is lit until Kill is chosen, so onlookers can't tell where you are.
    expect(screen.getByRole('tab', { name: 'Shift', selected: true })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dorothy' })).toBeNull()
    fireEvent.click(tab('Kill'))
    fireEvent.click(screen.getByRole('button', { name: 'Dorothy' }))
    fireEvent.click(tab('Shift'))
    expect(panel().getByText(/^Tap an arrow to slide/)).toBeInTheDocument()
    expect(
      bar().getByText('Tap an arrow on the edge to slide a row or column.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dorothy' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Shift row 2 right' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Shift row 1 left' }))
    fireEvent.click(screen.getByRole('button', { name: 'Shift row 1 right' }))
    expect(
      screen.getByRole('button', { name: 'Shift row 1 right', pressed: true }),
    ).toBeInTheDocument()
    // Switching away and back starts the action afresh.
    fireEvent.click(tab('Kill'))
    expect(bar().getByText('Tap a lit suspect to kill.')).toBeInTheDocument()
    fireEvent.click(tab('Shift'))
    expect(bar().queryByRole('button')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Shift row 1 right' }))
    fireEvent.click(bar().getByRole('button', { name: 'Shift row 1 right' }))
    expect(send).toHaveBeenCalledWith(
      sent({ t: 'shift', action: 'shift', line: { axis: 'row', index: 0 }, by: 1 }),
    )
  })

  it('disguises, and says why no one can be killed', () => {
    const { send } = phone(duelView({ me: killer }), [{ t: 'simple', action: 'disguise' }])
    expect(screen.getByRole('tab', { name: 'Disguise', selected: true })).toBeInTheDocument()
    expect(panel().getByText(/^Draw a new identity/)).toBeInTheDocument()
    fireEvent.click(tab('Kill'))
    expect(panel().getByText(/^No one alive is next to you/)).toBeInTheDocument()
    fireEvent.click(tab('Collapse'))
    expect(panel().getByText(/^The city closes up only when/)).toBeInTheDocument()
    fireEvent.click(tab('Disguise'))
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
    fireEvent.click(tab('Collapse'))
    expect(panel().getByText(/^When every column, or every row, has a body/)).toBeInTheDocument()
    expect(bar().getByText('Choose which way the city closes up.')).toBeInTheDocument()
    fireEvent.click(panel().getByRole('button', { name: 'Take a body from each column' }))
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

  it('collapses again or stops when the city still qualifies, without the other tabs', () => {
    const more = { id: 9, actor: 0, kind: 'substep', prompt: 'collapse_more' } as const
    const stop: Opt = { t: 'simple', action: 'stop_collapsing' }
    const { send } = phone(duelView({ me: killer, pending: more }), [
      { t: 'collapse', action: 'collapse', options: [{ direction: 'rows', lines: [[3], [8]] }] },
      stop,
    ])
    expect(screen.getByText(/can close up again/)).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(bar().getByText('Ready: one body from each line.')).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Collapse again' }))
    expect(send).toHaveBeenCalledWith(
      sent({ t: 'collapse', action: 'collapse', direction: 'rows', picks: [3, 8] }, 9),
    )
    cleanup()
    const two = phone(duelView({ me: killer, pending: more }), [
      {
        t: 'collapse',
        action: 'collapse',
        options: [
          { direction: 'columns', lines: [[3], [8]] },
          { direction: 'rows', lines: [[3], [8]] },
        ],
      },
      stop,
    ])
    expect(bar().getByText('Choose which way the city closes up.')).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Stop' }))
    expect(two.send).toHaveBeenCalledWith(sent({ t: 'simple', action: 'stop_collapsing' }, 9))
  })

  it('waits during the other player’s turn, with the room buttons out of the way', () => {
    phone(duelView({ me: killer, pending: { id: 8, actor: 1, kind: 'turn', prompt: 'turn' } }))
    expect(screen.getByText('Bob to move.')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(bar().queryByRole('button')).toBeNull()
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('button', { name: 'End game' }),
    )
  })
})

describe('the inspector’s phone', () => {
  const choosing = (cards: number[], prompt: 'choose_identity' | 'exonerate_discard') => {
    const view = duelView({
      me: { seat: 1, role: 'inspector', hand: cards },
      pending: {
        id: 7,
        actor: 1,
        kind: prompt === 'choose_identity' ? 'setup' : 'substep',
        prompt,
      },
      board: {
        ...duelView().board,
        tiles: duelView().board.tiles.map((tile) =>
          tile.id === 4 ? { ...tile, alive: false } : tile,
        ),
      },
    })
    return phone(view, [{ t: 'pick', action: prompt, cards, min: 1, max: 1 }])
  }
  const cards = () => within(screen.getByRole('group', { name: 'Tap a card to choose it.' }))
  const city = () => within(screen.getByRole('group', { name: 'The city' }))

  it('picks an identity from the four drawn cards, or on the city by a switch', () => {
    const { send } = choosing([3, 4, 5, 6], 'choose_identity')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(bar().getByText('Tap a card to choose it.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Cards', checked: true })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'The city' })).toBeNull()
    // A card naming someone dead keeps its X among the cards too.
    expect(cards().getByRole('button', { name: 'Cora, dead' })).toHaveAttribute('data-dead')
    expect(cards().getByRole('button', { name: 'Bruno' })).not.toHaveAttribute('data-dead')
    fireEvent.click(cards().getByRole('button', { name: 'Bruno' }))
    fireEvent.click(screen.getByRole('radio', { name: 'In the city' }))
    expect(screen.queryByRole('group', { name: 'Tap a card to choose it.' })).toBeNull()
    // The same four are lit on the board, a dead one included; everyone else isn't.
    for (const name of ['Bruno', /^Cora/, 'Calvin', 'Dorothy'])
      expect(city().getByRole('button', { name })).toHaveAttribute('data-lit')
    expect(city().queryByRole('button', { name: 'Ada' })).toBeNull()
    expect(city().getByRole('button', { name: 'Bruno', pressed: true })).toBeInTheDocument()
    fireEvent.click(city().getByRole('button', { name: 'Calvin' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Cards' }))
    expect(cards().getByRole('button', { name: 'Calvin', pressed: true })).toBeInTheDocument()
    expect(cards().getByRole('button', { name: 'Bruno', pressed: false })).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Be Calvin' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'pick', action: 'choose_identity', cards: [5] }))
  })

  it('clears a card whose suspect has left the city: it shows among the cards only', () => {
    const { send } = choosing([3, 5, 30], 'exonerate_discard')
    fireEvent.click(cards().getByRole('button', { name: 'Rosalind, dead' }))
    fireEvent.click(screen.getByRole('radio', { name: 'In the city' }))
    expect(city().queryByRole('button', { name: /^Rosalind/ })).toBeNull()
    expect(city().getByRole('button', { name: 'Bruno', pressed: false })).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Clear Rosalind' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'pick', action: 'exonerate_discard', cards: [30] }))
  })

  it('accuses a neighbour, switching to clearing a suspect and back', () => {
    const view = duelView({
      me: inspector,
      pending: { id: 7, actor: 1, kind: 'turn', prompt: 'turn' },
    })
    const { send } = phone(view, [
      { t: 'target', action: 'accuse', targets: [0, 1] },
      { t: 'simple', action: 'exonerate' },
      shiftRow1,
    ])
    expect(screen.getByRole('tab', { name: 'Shift', selected: true })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abe' })).toBeNull()
    fireEvent.click(tab('Accuse'))
    expect(panel().getByText(/If not, the game goes on\.$/)).toBeInTheDocument()
    expect(bar().getByText('Tap a lit suspect to accuse.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abe' }))
    fireEvent.click(tab('Clear a suspect'))
    expect(panel().getByText(/^Draw a card, then put one of your four/)).toBeInTheDocument()
    expect(bar().getByRole('button', { name: 'Clear a suspect' })).toBeInTheDocument()
    fireEvent.click(tab('Accuse'))
    fireEvent.click(screen.getByRole('button', { name: 'Abe' }))
    fireEvent.click(bar().getByRole('button', { name: 'Accuse Abe' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'target', action: 'accuse', target: 1 }))
  })

  it('clears a suspect, and says when the deck has run out', () => {
    const turn = { id: 7, actor: 1, kind: 'turn', prompt: 'turn' } as const
    const { send } = phone(duelView({ me: inspector, pending: turn }), [
      { t: 'target', action: 'accuse', targets: [1] },
      { t: 'simple', action: 'exonerate' },
    ])
    // Without Shift, the turn still opens on an action that lights no one.
    expect(screen.getByRole('tab', { name: 'Clear a suspect', selected: true })).toBeInTheDocument()
    fireEvent.click(bar().getByRole('button', { name: 'Clear a suspect' }))
    expect(send).toHaveBeenCalledWith(sent({ t: 'simple', action: 'exonerate' }))
    cleanup()
    phone(duelView({ me: inspector, pending: turn, deckCount: 0 }), [shiftRow1])
    expect(screen.getByRole('tab', { name: 'Shift', selected: true })).toBeInTheDocument()
    fireEvent.click(tab('Clear a suspect'))
    expect(panel().getByText('The deck is empty, so there’s no card to draw.')).toBeInTheDocument()
    fireEvent.click(tab('Accuse'))
    expect(panel().getByText('No one can be accused right now.')).toBeInTheDocument()
  })

  it('says only that it isn’t possible when no reason is public', () => {
    const turn = { id: 7, actor: 1, kind: 'turn', prompt: 'turn' } as const
    phone(duelView({ me: inspector, pending: turn }), [shiftRow1])
    fireEvent.click(tab('Clear a suspect'))
    expect(panel().getByText('Not possible right now.')).toBeInTheDocument()
  })
})

describe('the player’s file', () => {
  it('opens over the whole screen only while held, with the city marking where you stand', () => {
    phone(duelView({ me: inspector, pending: undefined }))
    const file = screen.getByRole('button', { name: 'Your file: Hold to look' })
    expect(screen.getByText('You’re the inspector')).toBeInTheDocument()
    expect(document.querySelector('.dossier__open')).toBeNull()
    fireEvent.pointerDown(file)
    expect(file).toHaveAttribute('aria-pressed', 'true')
    // Shown, not read out: the open file is hidden from screen readers, which hear one sentence instead.
    const open = within(document.querySelector('.dossier__open') as HTMLElement)
    expect(open.getAllByRole('img', { name: 'Ada, you', hidden: true })).toHaveLength(2)
    expect(open.getByRole('group', { name: 'The city', hidden: true })).toBeInTheDocument()
    // The evidence is in the hand and marked in the city: Bruno, Cora and Calvin, the hand's 3, 4 and 5.
    const city = within(open.getByRole('group', { name: 'The city', hidden: true }))
    for (const name of ['Bruno', 'Cora', 'Calvin']) {
      expect(open.getByRole('img', { name, hidden: true })).not.toHaveAttribute('data-evidence')
      expect(city.getByRole('img', { name: `${name}, evidence`, hidden: true })).toHaveAttribute(
        'data-evidence',
      )
    }
    expect(city.getByRole('img', { name: 'Gloria', hidden: true })).not.toHaveAttribute(
      'data-evidence',
    )
    expect(open.getByText('Let go to hide it. Keep it from the others.')).toBeInTheDocument()
    expect(
      screen.getByText('You are Ada. Evidence in your hand: Bruno, Cora, Calvin.'),
    ).toBeInTheDocument()
    // The game's own board never marks the player's tile.
    expect(screen.getByRole('group', { name: 'The city' }).querySelector('[data-mine]')).toBeNull()
    fireEvent.pointerUp(file)
    expect(document.querySelector('.dossier__open')).toBeNull()
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
    expect(screen.getByText(/^Kill a living suspect in one of the eight tiles/)).toBeInTheDocument()
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
