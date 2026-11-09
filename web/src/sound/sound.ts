/**
 * The game's sounds, synthesised with the Web Audio API: paper, typewriter keys and rubber stamps.
 * Nothing is downloaded (the CSP allows no media sources), and nothing plays until someone has
 * touched the page, as browsers require. Each device can switch sound off; the choice is remembered.
 */

export type SoundName = 'pageTurn' | 'pageBack' | 'folder' | 'key' | 'stamp'

const STORAGE_KEY = 'precinctnoir.sound'
const MASTER_GAIN = 0.55

let context: AudioContext | undefined
let master: GainNode | undefined
let noise: AudioBuffer | undefined
const listeners = new Set<() => void>()

/** Whether this device plays sounds (on unless switched off here). */
export function soundOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // The choice lasts for this page only.
  }
  listeners.forEach((listener) => listener())
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Plays [name] now, if sound is on and the browser can make it. Never throws. */
export function play(name: SoundName): void {
  if (!soundOn()) return
  const ctx = audio()
  if (!ctx || !master) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)
  RECIPES[name](ctx, master, ctx.currentTime)
}

/** Forgets the audio graph, so a test can stub `AudioContext` afresh. */
export function resetSoundForTests(): void {
  context = undefined
  master = undefined
  noise = undefined
}

function audio(): AudioContext | undefined {
  if (context) return context
  const Context = window.AudioContext
  if (typeof Context !== 'function') return undefined
  try {
    context = new Context()
  } catch {
    return undefined
  }
  master = context.createGain()
  master.gain.value = MASTER_GAIN
  master.connect(context.destination)
  return context
}

/** A second of white noise, the raw stuff of paper and keys. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

interface Burst {
  readonly duration: number
  /** Filter sweep, Hz. */
  readonly from: number
  readonly to: number
  readonly q: number
  readonly gain: number
  readonly filter?: BiquadFilterType
}

/** Filtered noise with a quick swell and a fade: a swish of paper, a click, a thud. */
function burst(ctx: AudioContext, out: AudioNode, at: number, b: Burst): void {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = b.filter ?? 'bandpass'
  filter.Q.value = b.q
  filter.frequency.setValueAtTime(b.from, at)
  filter.frequency.exponentialRampToValueAtTime(b.to, at + b.duration)
  const amp = envelope(ctx, at, b.duration, b.gain)
  source.connect(filter)
  filter.connect(amp)
  amp.connect(out)
  source.start(at, Math.random() * 0.5)
  source.stop(at + b.duration + 0.05)
}

interface Tone {
  readonly duration: number
  readonly from: number
  readonly to: number
  readonly gain: number
  readonly wave: OscillatorType
}

/** A short falling tone: the body of a stamp, the ping of a type bar. */
function tone(ctx: AudioContext, out: AudioNode, at: number, t: Tone): void {
  const osc = ctx.createOscillator()
  osc.type = t.wave
  osc.frequency.setValueAtTime(t.from, at)
  osc.frequency.exponentialRampToValueAtTime(t.to, at + t.duration)
  const amp = envelope(ctx, at, t.duration, t.gain)
  osc.connect(amp)
  amp.connect(out)
  osc.start(at)
  osc.stop(at + t.duration + 0.05)
}

function envelope(ctx: AudioContext, at: number, duration: number, peak: number): GainNode {
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.03, duration * 0.3))
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  return amp
}

type Recipe = (ctx: AudioContext, out: AudioNode, at: number) => void

/** A page lifting and flapping down: a swish that falls in pitch, then a soft landing. */
const flap =
  (from: number, to: number): Recipe =>
  (ctx, out, at) => {
    burst(ctx, out, at, { duration: 0.34, from, to, q: 0.9, gain: 0.32 })
    burst(ctx, out, at + 0.27, {
      duration: 0.1,
      from: 420,
      to: 160,
      q: 0.7,
      gain: 0.22,
      filter: 'lowpass',
    })
  }

const RECIPES: Readonly<Record<SoundName, Recipe>> = {
  pageTurn: flap(2600, 700),
  pageBack: flap(800, 2400),
  folder: (ctx, out, at) => {
    burst(ctx, out, at, { duration: 0.55, from: 1500, to: 450, q: 0.6, gain: 0.2 })
    burst(ctx, out, at + 0.44, {
      duration: 0.14,
      from: 320,
      to: 110,
      q: 0.7,
      gain: 0.3,
      filter: 'lowpass',
    })
  },
  key: (ctx, out, at) => {
    burst(ctx, out, at, {
      duration: 0.035,
      from: 4200,
      to: 2400,
      q: 1.1,
      gain: 0.28,
      filter: 'highpass',
    })
    tone(ctx, out, at, { duration: 0.045, from: 1900, to: 1300, gain: 0.04, wave: 'square' })
  },
  stamp: (ctx, out, at) => {
    tone(ctx, out, at, { duration: 0.2, from: 125, to: 45, gain: 0.7, wave: 'sine' })
    burst(ctx, out, at, {
      duration: 0.09,
      from: 1000,
      to: 200,
      q: 0.7,
      gain: 0.4,
      filter: 'lowpass',
    })
  },
}
