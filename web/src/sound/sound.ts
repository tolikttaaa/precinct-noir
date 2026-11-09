/**
 * The game's sounds, synthesised with the Web Audio API: paper, typewriter keys, rubber stamps, and the
 * sounds of the game itself (a shot, a drawer of suspects sliding, the closing sting). Nothing is
 * downloaded (the CSP allows no media sources), and nothing plays until someone has touched the page,
 * as browsers require. Each device sets how loud the effects are (`levels.ts`); the choice is remembered.
 */
import { gainOf, subscribeLevels } from './levels'

export type SoundName =
  | 'pageTurn'
  | 'pageBack'
  | 'folder'
  | 'key'
  | 'stamp'
  | 'shot'
  | 'slam'
  | 'slide'
  | 'rumble'
  | 'coat'
  | 'deal'
  | 'clock'
  | 'caseClosed'
  | 'killerWins'

/** Sounds loud enough that the music steps back for them. */
const LOUD: ReadonlySet<SoundName> = new Set(['shot', 'slam', 'rumble', 'caseClosed', 'killerWins'])

const MASTER_GAIN = 0.55

let context: AudioContext | undefined
/** Everything on its way out: the effects and the music. */
let master: GainNode | undefined
/** The effects' own volume, before the master. */
let effects: GainNode | undefined
let noise: AudioBuffer | undefined
const loudListeners = new Set<() => void>()

// The effects follow their slider at once, even mid-sound.
subscribeLevels(() => {
  if (context && effects) effects.gain.setTargetAtTime(gainOf('effects'), context.currentTime, 0.03)
})

/**
 * Plays [name] after [delay] seconds (now by default), unless the effects are muted here or the browser
 * can't make sound. Never throws.
 */
export function play(name: SoundName, delay = 0): void {
  if (gainOf('effects') === 0) return
  const ctx = audio()
  if (!ctx || !effects) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)
  if (LOUD.has(name)) loudListeners.forEach((listener) => listener())
  RECIPES[name](ctx, effects, ctx.currentTime + delay)
}

/** Tells [listener] whenever a loud sound starts (the music ducks under it). */
export function onLoudSound(listener: () => void): () => void {
  loudListeners.add(listener)
  return () => loudListeners.delete(listener)
}

/**
 * The page's one audio context and the output the game sounds go through (the master level), shared
 * with the music; undefined where the browser has no audio.
 */
export function sharedAudio():
  { readonly context: AudioContext; readonly output: AudioNode } | undefined {
  const ctx = audio()
  return ctx ? { context: ctx, output: master as GainNode } : undefined
}

/** Forgets the audio graph, so a test can stub `AudioContext` afresh. */
export function resetSoundForTests(): void {
  context = undefined
  master = undefined
  effects = undefined
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
  // Turned right up, a shot over the music could clip: a limiter keeps the peaks under full scale.
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.002
  limiter.release.value = 0.2
  master.connect(limiter)
  limiter.connect(context.destination)
  effects = context.createGain()
  effects.gain.value = gainOf('effects')
  effects.connect(master)
  return context
}

/** A second of white noise, the raw stuff of paper and keys. */
export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

export interface Burst {
  readonly duration: number
  /** Filter sweep, Hz. */
  readonly from: number
  readonly to: number
  readonly q: number
  readonly gain: number
  readonly filter?: BiquadFilterType
}

/** Filtered noise with a quick swell and a fade: a swish of paper, a click, a thud. */
export function burst(ctx: AudioContext, out: AudioNode, at: number, b: Burst): void {
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

export interface Tone {
  readonly duration: number
  readonly from: number
  readonly to: number
  readonly gain: number
  readonly wave: OscillatorType
}

/** A short falling tone: the body of a stamp, the ping of a type bar. */
export function tone(ctx: AudioContext, out: AudioNode, at: number, t: Tone): void {
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

export function envelope(ctx: AudioContext, at: number, duration: number, peak: number): GainNode {
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.03, duration * 0.3))
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  return amp
}

type Recipe = (ctx: AudioContext, out: AudioNode, at: number) => void

/** Semitones as a frequency ratio. */
const semis = (n: number) => 2 ** (n / 12)

/**
 * A brass section's stab: each note as two slightly detuned saw waves, through a filter that closes
 * as the chord dies away.
 */
function chord(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  notes: readonly number[],
  duration: number,
  gain: number,
): void {
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 0.8
  filter.frequency.setValueAtTime(2400, at)
  filter.frequency.exponentialRampToValueAtTime(420, at + duration)
  const amp = envelope(ctx, at, duration, gain)
  filter.connect(amp)
  amp.connect(out)
  for (const note of notes) {
    for (const cents of [-7, 7]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(note * semis(cents / 100), at)
      osc.connect(filter)
      osc.start(at)
      osc.stop(at + duration + 0.05)
    }
  }
}

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
  /** A revolver in an alley: the crack, the punch, and the street throwing it back. */
  shot: (ctx, out, at) => {
    burst(ctx, out, at, {
      duration: 0.06,
      from: 5200,
      to: 1400,
      q: 0.4,
      gain: 0.75,
      filter: 'highpass',
    })
    tone(ctx, out, at, { duration: 0.2, from: 160, to: 38, gain: 0.8, wave: 'sine' })
    burst(ctx, out, at + 0.02, {
      duration: 1.2,
      from: 1600,
      to: 140,
      q: 0.5,
      gain: 0.22,
      filter: 'lowpass',
    })
  },
  /** An accusation: a fist on the desk, and the desk answering. */
  slam: (ctx, out, at) => {
    tone(ctx, out, at, { duration: 0.28, from: 115, to: 42, gain: 0.8, wave: 'sine' })
    burst(ctx, out, at, {
      duration: 0.14,
      from: 900,
      to: 150,
      q: 0.8,
      gain: 0.5,
      filter: 'lowpass',
    })
    tone(ctx, out, at + 0.01, { duration: 0.08, from: 720, to: 480, gain: 0.12, wave: 'triangle' })
  },
  /** A row of the city moving: a heavy filing drawer rolling out, and its stop. */
  slide: (ctx, out, at) => {
    burst(ctx, out, at, { duration: 0.55, from: 360, to: 950, q: 1.3, gain: 0.3 })
    burst(ctx, out, at + 0.5, {
      duration: 0.13,
      from: 520,
      to: 120,
      q: 0.7,
      gain: 0.35,
      filter: 'lowpass',
    })
    tone(ctx, out, at + 0.5, { duration: 0.16, from: 95, to: 50, gain: 0.3, wave: 'sine' })
  },
  /** The city closing its gaps: a low rumble and the bodies being cleared away. */
  rumble: (ctx, out, at) => {
    burst(ctx, out, at, { duration: 1.3, from: 280, to: 45, q: 0.4, gain: 0.55, filter: 'lowpass' })
    tone(ctx, out, at, { duration: 0.7, from: 72, to: 34, gain: 0.5, wave: 'sine' })
    for (const later of [0.35, 0.75]) {
      burst(ctx, out, at + later, {
        duration: 0.16,
        from: 420,
        to: 100,
        q: 0.7,
        gain: 0.3,
        filter: 'lowpass',
      })
    }
  },
  /** A disguise: a coat swung on, in three rustles. */
  coat: (ctx, out, at) => {
    for (const [later, gain] of [
      [0, 0.17],
      [0.12, 0.13],
      [0.27, 0.1],
    ]) {
      burst(ctx, out, at + later, { duration: 0.17, from: 2300, to: 850, q: 0.5, gain })
    }
  },
  /** A card dealt onto the table. */
  deal: (ctx, out, at) => {
    burst(ctx, out, at, {
      duration: 0.07,
      from: 6200,
      to: 2600,
      q: 0.6,
      gain: 0.22,
      filter: 'highpass',
    })
    burst(ctx, out, at + 0.05, {
      duration: 0.06,
      from: 620,
      to: 200,
      q: 0.7,
      gain: 0.13,
      filter: 'lowpass',
    })
  },
  /** Taking too long: the station clock, tick-tock, tick-tock. */
  clock: (ctx, out, at) => {
    for (let i = 0; i < 4; i++) {
      const pitch = i % 2 === 0 ? 2400 : 1800
      tone(ctx, out, at + i * 0.5, {
        duration: 0.035,
        from: pitch,
        to: pitch * 0.9,
        gain: 0.1,
        wave: 'square',
      })
    }
  },
  /** The inspector's arrest: the band holds a dominant chord, then resolves it. */
  caseClosed: (ctx, out, at) => {
    chord(ctx, out, at, [110, 277.18, 392, 466.16], 0.38, 0.11)
    chord(ctx, out, at + 0.42, [146.83, 369.99, 440, 659.26], 2.4, 0.12)
    tone(ctx, out, at + 0.42, { duration: 1.6, from: 74, to: 70, gain: 0.5, wave: 'sine' })
  },
  /** The killer gets away: a dark minor chord with a sharp seventh over a timpani hit. */
  killerWins: (ctx, out, at) => {
    tone(ctx, out, at, { duration: 1.4, from: 62, to: 46, gain: 0.6, wave: 'sine' })
    chord(ctx, out, at + 0.05, [146.83, 349.23, 440, 554.37], 2.8, 0.12)
    chord(ctx, out, at + 0.05, [73.42], 2.8, 0.09)
  },
}
