import { describe, expect, it } from 'vitest'
import { cuesFor, duelCues } from './sounds'

describe('duelCues', () => {
  it.each([
    [{ t: 'game_started', killer: 0, inspector: 1 }, [['stamp', 0]]],
    [{ t: 'killed', seat: 0, victim: 3, kills: 1 }, [['shot', 0]]],
    [{ t: 'accused', seat: 1, target: 3, correct: false }, [['slam', 0]]],
    [{ t: 'shifted', seat: 0, line: { axis: 'row', index: 1 }, by: 1 }, [['slide', 0]]],
    [{ t: 'collapsed', seat: 0, direction: 'rows', removed: [1] }, [['rumble', 0]]],
    [{ t: 'disguised', seat: 0, discarded: 4 }, [['coat', 0]]],
    [
      { t: 'disguised', seat: 0, exonerated: 4 },
      [
        ['coat', 0],
        ['stamp', 0.45],
      ],
    ],
    [{ t: 'exonerated', seat: 1, card: 4, placed: false }, [['deal', 0]]],
    [{ t: 'exonerated', seat: 1, card: 4, placed: true, killerAdjacent: false }, [['stamp', 0]]],
    [
      { t: 'cards_drawn', seat: 1, count: 5 },
      [
        ['deal', 0],
        ['deal', 0.12],
        ['deal', 0.24],
        ['deal', 0.36],
      ],
    ],
    [{ t: 'identity_chosen', seat: 1 }, [['deal', 0]]],
    [{ t: 'nudged', seat: 1 }, [['clock', 0]]],
    [
      { t: 'game_over', outcome: { winners: [1], reason: 'killer_caught' }, reveal: {} },
      [['caseClosed', 0.25]],
    ],
    [
      { t: 'game_over', outcome: { winners: [0], reason: 'kill_quota' }, reveal: {} },
      [['killerWins', 0.25]],
    ],
    [{ t: 'turn_started', seat: 0, turn: 2 }, []],
    [{ t: 'you_drew', cards: [1] }, []],
  ])('%o sounds like %o', (event, cues) => {
    expect(duelCues(event)).toEqual(cues)
  })

  it('belongs to Shadow Duel only', () => {
    expect(cuesFor('killer_inspector')).toBe(duelCues)
    expect(cuesFor('spy_ring')).toBeUndefined()
    expect(cuesFor(undefined)).toBeUndefined()
  })
})
