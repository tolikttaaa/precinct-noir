import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  play,
  resetSoundForTests,
  setSoundOn,
  soundOn,
  subscribeSound,
  type SoundName,
} from './sound'

/** Just enough of the Web Audio API to see what each sound builds. */
class FakeContext {
  static made = 0
  static failing = false
  state: AudioContextState = 'suspended'
  readonly sampleRate = 100
  readonly currentTime = 2
  readonly destination = {}
  readonly nodes: string[] = []
  resume = vi.fn(() => Promise.reject(new Error('no gesture yet')))

  constructor() {
    if (FakeContext.failing) throw new Error('no audio device')
    FakeContext.made++
  }

  private node(kind: string) {
    this.nodes.push(kind)
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    })
    return {
      type: '',
      buffer: null,
      gain: param(),
      frequency: param(),
      Q: param(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
  }

  createGain = () => this.node('gain')
  createBiquadFilter = () => this.node('filter')
  createBufferSource = () => this.node('noise')
  createOscillator = () => this.node('tone')
  createBuffer = (_channels: number, length: number) => {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
}

function withAudio(): FakeContext[] {
  const made: FakeContext[] = []
  vi.stubGlobal(
    'AudioContext',
    class extends FakeContext {
      constructor() {
        super()
        made.push(this)
      }
    },
  )
  return made
}

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
