import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LEVEL,
  gainOf,
  levelOf,
  resetLevelsForTests,
  setLevel,
  setMuted,
  subscribeLevels,
} from './levels'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('levels', () => {
  it('start where the game was mixed, and say how loud against it', () => {
    expect(levelOf('music')).toEqual({ level: DEFAULT_LEVEL, muted: false })
    expect(gainOf('music')).toBe(1)
    setLevel('music', 35)
    expect(gainOf('music')).toBe(0.25)
    setLevel('music', 100)
    expect(gainOf('music')).toBeCloseTo(2.04, 2)
    setLevel('effects', 0)
    expect(gainOf('effects')).toBe(0)
  })

  it('keep a muted level for when it comes back, and bring a level turned right down back up', () => {
    setLevel('effects', 40)
    setMuted('effects', true)
    expect(levelOf('effects')).toEqual({ level: 40, muted: true })
    expect(gainOf('effects')).toBe(0)
    setMuted('effects', false)
    expect(levelOf('effects')).toEqual({ level: 40, muted: false })
    setLevel('effects', 0)
    setMuted('effects', false)
    expect(levelOf('effects').level).toBe(DEFAULT_LEVEL)
    // Moving the slider unmutes.
    setMuted('effects', true)
    setLevel('effects', 55)
    expect(levelOf('effects')).toEqual({ level: 55, muted: false })
  })

  it('stay within 0 to 100 in whole steps', () => {
    setLevel('music', 140)
    expect(levelOf('music').level).toBe(100)
    setLevel('music', -3)
    expect(levelOf('music').level).toBe(0)
    setLevel('music', 42.6)
    expect(levelOf('music').level).toBe(43)
  })

  it('are remembered on this device, one store answer per change, and tell listeners', () => {
    const listener = vi.fn()
    const stop = subscribeLevels(listener)
    setLevel('music', 20)
    setMuted('music', true)
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    const before = levelOf('music')
    expect(levelOf('music')).toBe(before)
    resetLevelsForTests()
    expect(levelOf('music')).toEqual({ level: 20, muted: true })
    expect(localStorage.getItem('precinctnoir.volume.music')).toBe('{"level":20,"muted":true}')
  })

  it('fall back to the start level when storage is unreadable or blocked', () => {
    localStorage.setItem('precinctnoir.volume.music', '{not json')
    localStorage.setItem('precinctnoir.volume.effects', '{"level":"loud"}')
    expect(levelOf('music')).toEqual({ level: DEFAULT_LEVEL, muted: false })
    expect(levelOf('effects')).toEqual({ level: DEFAULT_LEVEL, muted: false })
    resetLevelsForTests()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(levelOf('music').level).toBe(DEFAULT_LEVEL)
    expect(() => setLevel('music', 10)).not.toThrow()
    expect(levelOf('music').level).toBe(10) // for this page, at least
  })
})
