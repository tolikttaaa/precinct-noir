import { describe, expect, it, vi } from 'vitest'
import { roomView } from '../test/fixtures'

// These cases cover the drawn portraits; suspects.photos.test.ts covers suspects with pictures.
vi.mock('../portraits/photos', () => ({ PHOTOS: new Map(), photoData: vi.fn() }))
import type { RoomState } from '../net/roomSocket'
import type { CollapseOption, Opt } from '../protocol/generated'
import { GUIDES, guideText, hasGuide } from './guides'
import i18next from 'i18next'
import { direction, glide } from './motion'
import { canShift, choice, collapsePicks, duelOf, readMoves, seatName } from './shadowDuel/moves'
import { RU_NAMES } from '../i18n/suspectNames'
import { ROSTER } from '../portraits/roster'
import { fileNumber, genderOf, portraitOf, suspectName } from './suspects'

describe('suspects', () => {
  it('draw each portrait once and reuse it', () => {
    const first = portraitOf(3)
    expect(first).toMatch(/^data:image\/svg\+xml/)
    expect(portraitOf(3)).toBe(first)
    expect(portraitOf(999)).toBeUndefined()
  })

  it('all have a Russian name', () => {
    expect(RU_NAMES).toHaveLength(ROSTER.length)
  })

  it('are named per language, with a number for strangers', () => {
    expect(suspectName(0, 'en')).toBe('Ada')
    expect(suspectName(0, 'ru')).toBe('Ада')
    expect(suspectName(59, 'ru-RU')).toBe('Морт')
    expect(suspectName(999, 'en')).toBe('#999')
  })

  it('know the gender their words agree with, and their file number', () => {
    expect([genderOf(0), genderOf(1), genderOf(999)]).toEqual(['f', 'm', 'm'])
    expect([fileNumber(0), fileNumber(18)]).toEqual(['0101', '0119'])
  })
})

describe('motion', () => {
  it('names the way a shift goes', () => {
    expect(direction({ axis: 'row', index: 0 }, 1)).toBe('right')
    expect(direction({ axis: 'row', index: 0 }, -1)).toBe('left')
    expect(direction({ axis: 'col', index: 0 }, 1)).toBe('down')
    expect(direction({ axis: 'col', index: 0 }, -1)).toBe('up')
  })

  it('glides a card one cell, or slides a wrapped card in from the edge', () => {
    expect(glide(-100, 0, 100, 120)).toEqual([
      { transform: 'translate(-100px, 0px)' },
      { transform: 'none' },
    ])
    expect(glide(400, 0, 100, 120)[0]).toEqual({ transform: 'translate(-100px, 0px)', opacity: 0 })
    expect(glide(0, -480, 100, 120)[0]).toEqual({ transform: 'translate(0px, 120px)', opacity: 0 })
  })
})

describe('legal moves', () => {
  const shift: Opt = {
    t: 'shift',
    action: 'shift',
    moves: [{ line: { axis: 'row', index: 1 }, by: 1 }],
  }

  it('are read into what the controls offer', () => {
    const moves = readMoves([
      shift,
      { t: 'target', action: 'kill', targets: [1, 5] },
      { t: 'target', action: 'other', targets: [2] },
      { t: 'simple', action: 'disguise' },
      { t: 'collapse', action: 'collapse', options: [{ direction: 'rows', lines: [[1]] }] },
      { t: 'pick', action: 'choose_identity', cards: [1, 2], min: 1, max: 1 },
      { t: 'vault', action: 'rob', vaults: ['nw'] },
    ])
    expect(moves.target).toEqual({ action: 'kill', ids: new Set([1, 5]) })
    expect(moves.simple).toEqual(['disguise'])
    expect(moves.collapse).toHaveLength(1)
    expect(moves.pick?.cards).toEqual([1, 2])
    expect(canShift(moves, { axis: 'row', index: 1 }, 1)).toBe(true)
    expect(canShift(moves, { axis: 'row', index: 1 }, -1)).toBe(false)
    expect(canShift(moves, { axis: 'col', index: 1 }, 1)).toBe(false)
    expect(canShift(moves, { axis: 'row', index: 2 }, 1)).toBe(false)
    expect(readMoves([])).toEqual({ shifts: [], simple: [] })
  })

  it('fill single-body lines of a collapse by themselves', () => {
    const option: CollapseOption = { direction: 'columns', lines: [[3], [4, 9], [5]] }
    expect(collapsePicks(option, new Map())).toEqual([3, undefined, 5])
    expect(collapsePicks(option, new Map([[1, 9]]))).toEqual([3, 9, 5])
  })

  it('build the choices the server expects', () => {
    const line = { axis: 'col', index: 2 } as const
    expect(choice.target('accuse', 4)).toEqual({ t: 'target', action: 'accuse', target: 4 })
    expect(choice.shift(line, -1)).toEqual({ t: 'shift', action: 'shift', line, by: -1 })
    expect(choice.collapse({ direction: 'rows', lines: [[1]] }, [1])).toEqual({
      t: 'collapse',
      action: 'collapse',
      direction: 'rows',
      picks: [1],
    })
    expect(choice.simple('disguise')).toEqual({ t: 'simple', action: 'disguise' })
    expect(choice.pick('choose_identity', 3)).toEqual({
      t: 'pick',
      action: 'choose_identity',
      cards: [3],
    })
  })

  it('name the player in a seat', () => {
    const room = roomView({ seats: [2, 1] })
    expect([seatName(room, 0), seatName(room, 1), seatName(room, 5)]).toEqual(['Bob', 'Ann', '?'])
  })
})

describe('the running duel', () => {
  const room = roomView({ status: 'in_game', round: 2, seats: [1, 2] })
  const state = (game?: Partial<RoomState['game']>): RoomState => ({
    connection: 'open',
    round: 2,
    events: [{ seq: 1, event: { t: 'turn_started', seat: 0, turn: 1 } }],
    replayedTo: 0,
    nudges: 0,
    game: game && { t: 'game', round: 2, mode: 'killer_inspector', view: {}, legal: [], ...game },
  })

  it('comes from a game message for this round of Shadow Duel', () => {
    expect(duelOf(state({}), room)?.events).toEqual([{ t: 'turn_started', seat: 0, turn: 1 }])
    expect(duelOf(state({}), { ...room, status: 'finished' })).toBeDefined()
  })

  it('is absent in the lobby, for other modes and for an old round', () => {
    expect(duelOf(state(), room)).toBeUndefined()
    expect(duelOf(state({}), { ...room, status: 'lobby' })).toBeUndefined()
    expect(duelOf(state({ mode: 'spy_ring' }), room)).toBeUndefined()
    expect(duelOf(state({ round: 1 }), room)).toBeUndefined()
  })
})

describe('guides', () => {
  it('exist per mode, with texts for every page in both languages', async () => {
    expect(hasGuide('killer_inspector')).toBe(true)
    expect(hasGuide('spy_ring')).toBe(false)
    for (const language of ['en', 'ru']) {
      await i18next.changeLanguage(language)
      for (const page of GUIDES.killer_inspector) {
        for (const part of ['title', 'body'] as const) {
          const text = guideText(i18next.t, 'killer_inspector', page.id, part)
          expect(text, `${language} ${page.id} ${part}`).not.toContain('guide.')
        }
      }
    }
    expect(GUIDES.killer_inspector.length).toBeLessThanOrEqual(20) // the server's page limit
  })
})
