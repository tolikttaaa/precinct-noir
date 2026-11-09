import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeContext, withAudio } from '../test/fakeAudio'
import { setLevel, setMuted } from './levels'
import { resetMusicForTests, startMusic } from './music'
import { play, resetSoundForTests } from './sound'

/** The gains made, in order: the master level, the effects' level, then each band's own volume. */
const gains = (ctx: FakeContext) => ctx.made.filter((node) => node.kind === 'gain')
const busOf = (ctx: FakeContext) => gains(ctx)[2]
const oscillators = (ctx: FakeContext) => ctx.made.filter((node) => node.kind === 'tone')

/** Starts the music with a fake audio device; the device appears once something wants sound. */
function band(): { ctx: FakeContext; stop: () => void } {
  const made = withAudio()
  const stop = startMusic()
  return { ctx: made[0], stop }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  resetMusicForTests()
  resetSoundForTests()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('music', () => {
  it('waits for a first touch, then plays the band bar after bar through the master level', () => {
    const { ctx } = band()
    const bus = busOf(ctx)
    expect(bus.connect).toHaveBeenCalledWith(ctx.made[0])
    // Browsers keep audio off until someone touches the page.
    vi.advanceTimersByTime(1000)
    expect(oscillators(ctx)).toHaveLength(0)
    document.dispatchEvent(new Event('pointerdown'))
    document.dispatchEvent(new Event('keydown'))
    expect(ctx.resume).toHaveBeenCalledTimes(2)
    ctx.state = 'running'
    vi.advanceTimersByTime(250)
    const firstBar = oscillators(ctx).length
    expect(firstBar).toBeGreaterThan(0)
    // Many times round the loop at once: bass, piano, and the trumpet's phrases and rests.
    ctx.currentTime = 600
    vi.advanceTimersByTime(250)
    const waves = new Set(oscillators(ctx).map((osc) => osc.type))
    expect(waves).toEqual(new Set(['sine', 'triangle', 'sawtooth', '']))
    // Once it runs, a touch has nothing to wake.
    ctx.resume.mockClear()
    document.dispatchEvent(new Event('pointerdown'))
    expect(ctx.resume).not.toHaveBeenCalled()
  })

  it('keeps playing when one screen hands it to the next, and fades out when none wants it', () => {
    const { ctx, stop: stopHome } = band()
    const bus = busOf(ctx)
    stopHome()
    stopHome() // giving it up twice changes nothing
    const stopBoard = startMusic()
    vi.advanceTimersByTime(1000)
    expect(bus.gain.setTargetAtTime).not.toHaveBeenCalled()
    expect(gains(ctx)).toHaveLength(3)
    stopBoard()
    vi.advanceTimersByTime(400)
    expect(bus.gain.setTargetAtTime).toHaveBeenCalledWith(0, 2, 0.25)
    expect(bus.disconnect).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(bus.disconnect).toHaveBeenCalled()
    // Nothing more is written once it has stopped.
    const made = ctx.made.length
    vi.advanceTimersByTime(5000)
    expect(ctx.made).toHaveLength(made)
  })

  it('follows its slider, stops when muted or turned right down, and comes back', () => {
    const { ctx } = band()
    const first = busOf(ctx)
    expect(first.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.24, 4) // fades in to its level
    setLevel('music', 35)
    expect(first.gain.cancelScheduledValues).toHaveBeenCalledWith(2)
    expect(first.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.06, 2, 0.05)
    setMuted('music', true)
    expect(first.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.25)
    setMuted('music', false)
    // Unmuted, a new band starts and fades in to the level it was left at.
    expect(gains(ctx)).toHaveLength(4)
    const again = gains(ctx)[3]
    expect(again).not.toBe(first)
    expect(again.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.06, 4) // back at its level
    setLevel('music', 0)
    expect(again.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.25)
    // The effects have no say over the music.
    setMuted('effects', true)
    setLevel('music', 70)
    expect(gains(ctx)).toHaveLength(5)
  })

  it('steps back while a loud sound plays', () => {
    const { ctx } = band()
    const bus = busOf(ctx)
    play('key')
    expect(bus.gain.setTargetAtTime).not.toHaveBeenCalled()
    play('shot')
    expect(bus.gain.cancelScheduledValues).toHaveBeenCalledWith(2)
    expect(bus.gain.setTargetAtTime).toHaveBeenNthCalledWith(1, expect.closeTo(0.072, 3), 2, 0.04)
    expect(bus.gain.setTargetAtTime).toHaveBeenNthCalledWith(2, 0.24, 3.6, 0.6)
  })

  it('stays silent without audio', () => {
    vi.stubGlobal('AudioContext', undefined)
    const stop = startMusic()
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    stop()
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
  })
})
