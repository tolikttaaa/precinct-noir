import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import type { ShadowDuelEvent } from '../../protocol/generated'
import { duelView, roomView } from '../../test/fixtures'
import { caseLog, logLine, promptText, yourPromptText } from './text'

// Seat 0 is Ann, seat 1 is Bob. Suspects: 0 Ada (f), 1 Abe (m), 2 Beatrice (f), 3 Bruno (m).
const room = roomView({ status: 'in_game', round: 1, seats: [1, 2] })
const line = (event: ShadowDuelEvent) => logLine(i18next.t, i18next.language, room, event)

describe('the case log in English', () => {
  it.each<[ShadowDuelEvent, string | null]>([
    [{ t: 'game_started', killer: 0, inspector: 1 }, 'Ann is the killer. Bob is the inspector.'],
    [{ t: 'killed', seat: 0, victim: 0, kills: 1 }, 'Ada was killed.'],
    [
      { t: 'killed', seat: 0, victim: 1, kills: 2, inspectorAdjacent: true },
      'Abe was killed. The inspector is next to the body.',
    ],
    [
      { t: 'killed', seat: 0, victim: 1, kills: 2, inspectorAdjacent: false },
      'Abe was killed. The inspector is not next to the body.',
    ],
    [{ t: 'shifted', seat: 1, line: { axis: 'row', index: 2 }, by: 1 }, 'Bob shifted row 3 right.'],
    [
      { t: 'shifted', seat: 0, line: { axis: 'col', index: 0 }, by: -1 },
      'Ann shifted column 1 up.',
    ],
    [
      { t: 'collapsed', seat: 0, direction: 'rows', removed: [0, 3] },
      'Ann closed up the city. Removed: Ada, Bruno.',
    ],
    [
      { t: 'disguised', seat: 0, exonerated: 2 },
      'The killer changed disguise. Beatrice is cleared.',
    ],
    [
      { t: 'disguised', seat: 0, discarded: 3 },
      'The killer tried a new disguise, but Bruno is no longer alive.',
    ],
    [{ t: 'disguised', seat: 0 }, null],
    [{ t: 'exonerated', seat: 1, card: 0, placed: true }, 'Bob cleared Ada.'],
    [
      { t: 'exonerated', seat: 1, card: 0, placed: true, killerAdjacent: true },
      'Bob cleared Ada. The killer is next to Ada.',
    ],
    [
      { t: 'exonerated', seat: 1, card: 1, placed: false, killerAdjacent: false },
      'Bob put Abe face up, but Abe is no longer alive. The killer is not next to Abe.',
    ],
    [{ t: 'accused', seat: 1, target: 3, correct: false }, 'Bob accused Bruno: not the killer.'],
    [{ t: 'accused', seat: 1, target: 3, correct: true }, 'Bob accused Bruno: that’s the killer!'],
    [{ t: 'identity_chosen', seat: 1 }, 'Bob has chosen an identity.'],
    [{ t: 'cards_drawn', seat: 1, count: 1 }, 'Bob drew 1 card.'],
    [{ t: 'cards_drawn', seat: 1, count: 4 }, 'Bob drew 4 cards.'],
    [{ t: 'you_drew', cards: [0, 1] }, 'You drew Ada, Abe.'],
    [{ t: 'your_identity', card: 2 }, 'You are Beatrice.'],
    [{ t: 'nudged', seat: 0 }, 'Time’s up for Ann.'],
    [{ t: 'turn_started', seat: 0, turn: 2 }, null],
    [
      { t: 'game_over', outcome: { winners: [0], reason: 'kill_quota' }, reveal: { seats: [] } },
      null,
    ],
  ])('%o', (event, text) => {
    expect(line(event)).toBe(text)
  })
})

describe('the case log in Russian', () => {
  it('agrees with each suspect’s gender', async () => {
    await i18next.changeLanguage('ru')
    expect(line({ t: 'killed', seat: 0, victim: 0, kills: 1 })).toBe('Ада убита.')
    expect(line({ t: 'killed', seat: 0, victim: 1, kills: 1 })).toBe('Эйб убит.')
    expect(line({ t: 'disguised', seat: 0, discarded: 2 })).toBe(
      'Убийца пытается сменить облик, но Беатрис мертва.',
    )
    expect(line({ t: 'exonerated', seat: 1, card: 3, placed: false })).toBe(
      'Bob открывает карту, но Бруно мёртв.',
    )
    expect(line({ t: 'cards_drawn', seat: 1, count: 4 })).toBe('Bob берёт 4 карты.')
  })
})

describe('the log list', () => {
  const events: ShadowDuelEvent[] = [
    { t: 'game_started', killer: 0, inspector: 1 },
    { t: 'your_identity', card: 2 },
    { t: 'turn_started', seat: 0, turn: 1 },
    { t: 'killed', seat: 0, victim: 0, kills: 1 },
    { t: 'cards_drawn', seat: 1, count: 4 },
  ]

  it('runs newest first, skips turn markers and stops at the limit', () => {
    expect(caseLog(i18next.t, 'en', room, events, 2, false)).toEqual([
      'Bob drew 4 cards.',
      'Ada was killed.',
    ])
    expect(caseLog(i18next.t, 'en', room, events, 9, false)).toContain('You are Beatrice.')
  })

  it('can leave out this device’s private draws', () => {
    expect(caseLog(i18next.t, 'en', room, events, 9, true)).toEqual([
      'Bob drew 4 cards.',
      'Ada was killed.',
      'Ann is the killer. Bob is the inspector.',
    ])
  })
})

describe('prompts', () => {
  it('say whose decision it is, on the board and on the actor’s phone', () => {
    const view = duelView({
      pending: { id: 1, actor: 1, kind: 'setup', prompt: 'choose_identity' },
    })
    expect(promptText(i18next.t, room, view)).toBe('Bob, the inspector, is choosing who to be.')
    expect(yourPromptText(i18next.t, view)).toMatch(/^You drew four suspects/)
    const over = duelView({ pending: undefined })
    expect(promptText(i18next.t, room, over)).toBe('')
    expect(yourPromptText(i18next.t, over)).toBe('')
  })
})
