import { vi } from 'vitest'

/** Just enough of the Web Audio API to see what each sound builds. */
export class FakeContext {
  static made = 0
  static failing = false
  state: AudioContextState = 'suspended'
  readonly sampleRate = 100
  currentTime = 2
  readonly destination = {}
  readonly nodes: string[] = []
  resume = vi.fn(() => Promise.reject(new Error('no gesture yet')))
  /** Every node made, in order, to look at what was played through them. */
  readonly made: ReturnType<FakeContext['node']>[] = []

  constructor() {
    if (FakeContext.failing) throw new Error('no audio device')
    FakeContext.made++
  }

  private node(kind: string) {
    this.nodes.push(kind)
    const made = this.made
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    })
    const node = {
      kind,
      type: '',
      buffer: null,
      gain: param(),
      frequency: param(),
      Q: param(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    made.push(node)
    return node
  }

  createGain = () => this.node('gain')
  createBiquadFilter = () => this.node('filter')
  createBufferSource = () => this.node('noise')
  createOscillator = () => this.node('tone')
  createDynamicsCompressor = () => this.node('limiter')
  createBuffer = (_channels: number, length: number) => {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
}

export function withAudio(): FakeContext[] {
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
