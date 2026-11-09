import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeContext, withAudio } from '../test/fakeAudio'
import { setLevel, setMuted } from './levels'
import { onLoudSound, play, resetSoundForTests, sharedAudio, type SoundName } from './sound'

/** The way out, made first: the master level, its limiter, then the effects' own level. */
const OUTPUT = ['gain', 'limiter', 'gain']

afterEach(() => {
  resetSoundForTests()
  FakeContext.failing = false
})

describe('sound', () => {
  it.each<[SoundName, string[]]>([
    ['pageTurn', ['noise', 'filter', 'gain', 'noise', 'filter', 'gain']],
    ['pageBack', ['noise', 'filter', 'gain', 'noise', 'filter', 'gain']],
    ['folder', ['noise', 'filter', 'gain', 'noise', 'filter', 'gain']],
    ['key', ['noise', 'filter', 'gain', 'tone', 'gain']],
    ['stamp', ['tone', 'gain', 'noise', 'filter', 'gain']],
  ])('synthesises %s from noise and tones', (name, nodes) => {
    const made = withAudio()
    play(name)
    expect(made).toHaveLength(1)
    expect(made[0].nodes).toEqual([...OUTPUT, ...nodes])
    // Every sound goes out through the effects' level, then the master and the limiter.
    const [master, limiter, effects] = made[0].made
    expect(master.connect).toHaveBeenCalledWith(limiter)
    expect(limiter.connect).toHaveBeenCalledWith(made[0].destination)
    expect(effects.connect).toHaveBeenCalledWith(master)
    expect(made[0].made[3].connect).not.toHaveBeenCalledWith(master)
    expect(made[0].resume).toHaveBeenCalled()
  })

  it.each<SoundName>([
    'shot',
    'slam',
    'slide',
    'rumble',
    'coat',
    'deal',
    'clock',
    'caseClosed',
    'killerWins',
  ])('synthesises the game sound %s', (name) => {
    const made = withAudio()
    play(name)
    const sources = made[0].made.filter((node) => node.kind === 'noise' || node.kind === 'tone')
    expect(sources.length).toBeGreaterThan(0)
    sources.forEach((source) => expect(source.start).toHaveBeenCalled())
  })

  it('plays a sound later on the audio clock when asked', () => {
    const made = withAudio()
    play('stamp', 1.5)
    const tone = made[0].made.find((node) => node.kind === 'tone')
    expect(tone?.start).toHaveBeenCalledWith(3.5) // the clock stands at 2
  })

  it('tells the music when a loud sound starts, and only then', () => {
    withAudio()
    const listener = vi.fn()
    const stop = onLoudSound(listener)
    play('key')
    expect(listener).not.toHaveBeenCalled()
    play('shot')
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    play('slam')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('shares its audio context and master level with the music', () => {
    expect(sharedAudio()).toBeUndefined() // jsdom has no audio
    const made = withAudio()
    const audio = sharedAudio()
    expect(audio?.context).toBe(made[0])
    expect(audio?.output).toBe(made[0].made[0]) // the master gain, made first
  })

  it('turns the effects up and down with their slider, even while they play', () => {
    const made = withAudio()
    setLevel('effects', 35)
    play('key')
    const effects = made[0].made[2]
    expect(effects.gain.value).toBe(0.25) // half the level, a quarter of the gain
    setLevel('effects', 100)
    expect(effects.gain.setTargetAtTime).toHaveBeenLastCalledWith(expect.closeTo(2.04, 2), 2, 0.03)
  })

  it('keeps one audio context and one noise buffer for every sound', () => {
    const made = withAudio()
    play('key')
    made[0].state = 'running'
    play('key')
    expect(made).toHaveLength(1)
    expect(made[0].resume).toHaveBeenCalledTimes(1)
  })

  it('stays silent when switched off, without audio, or when audio fails', () => {
    const made = withAudio()
    setMuted('effects', true)
    play('stamp')
    expect(made).toHaveLength(0)
    setMuted('effects', false)
    FakeContext.failing = true
    expect(() => play('stamp')).not.toThrow()
    vi.unstubAllGlobals()
    vi.stubGlobal('AudioContext', undefined)
    expect(() => play('stamp')).not.toThrow()
  })
})
