import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeContext, withAudio } from '../test/fakeAudio'
import {
  onLoudSound,
  play,
  resetSoundForTests,
  sharedAudio,
  setSoundOn,
  soundOn,
  subscribeSound,
  type SoundName,
} from './sound'

afterEach(() => {
  resetSoundForTests()
  FakeContext.failing = false
})

describe('sound', () => {
  it('is on until this device switches it off, and tells listeners', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSound(listener)
    expect(soundOn()).toBe(true)
    setSoundOn(false)
    expect(soundOn()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setSoundOn(true)
    expect(soundOn()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('still answers when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => setSoundOn(false)).not.toThrow()
    expect(soundOn()).toBe(true)
  })

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
    expect(made[0].nodes).toEqual(['gain', ...nodes]) // the master volume comes first
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
    setSoundOn(false)
    play('stamp')
    expect(made).toHaveLength(0)
    setSoundOn(true)
    FakeContext.failing = true
    expect(() => play('stamp')).not.toThrow()
    vi.unstubAllGlobals()
    vi.stubGlobal('AudioContext', undefined)
    expect(() => play('stamp')).not.toThrow()
  })
})
