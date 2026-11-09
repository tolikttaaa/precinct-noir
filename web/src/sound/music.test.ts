import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeContext, withAudio } from '../test/fakeAudio'
import { musicOn, resetMusicForTests, setMusicOn, startMusic, subscribeMusic } from './music'
import { play, resetSoundForTests, setSoundOn } from './sound'

/** The music's own volume control: the first gain made after the master level. */
const busOf = (ctx: FakeContext) => ctx.made.filter((node) => node.kind === 'gain')[1]
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
  it('is on until this device switches it off, and tells listeners', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeMusic(listener)
    expect(musicOn()).toBe(true)
    setMusicOn(false)
    expect(musicOn()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setMusicOn(true)
    expect(musicOn()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('still answers when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => setMusicOn(false)).not.toThrow()
    expect(musicOn()).toBe(true)
    vi.restoreAllMocks()
  })

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
    expect(ctx.made.filter((node) => node.kind === 'gain')).toHaveLength(2)
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

  it('stops for its own switch and for the sound switch, and comes back with them', () => {
    const { ctx } = band()
    const first = busOf(ctx)
    setMusicOn(false)
    expect(first.gain.setTargetAtTime).toHaveBeenCalledWith(0, 2, 0.25)
    setMusicOn(true)
    const gains = () => ctx.made.filter((node) => node.kind === 'gain')
    const second = gains().at(-1)
    expect(second).not.toBe(first)
    setSoundOn(false)
    expect(second?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 2, 0.25)
    const count = gains().length
    setMusicOn(true) // music on, sound still off: silent
    expect(gains()).toHaveLength(count)
    setSoundOn(true)
    expect(gains().length).toBeGreaterThan(count)
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
