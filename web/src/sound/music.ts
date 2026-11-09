/**
 * The board's background music: a slow, smoky jazz loop written for this game and played live by the
 * browser (nothing is downloaded). Upright bass walks under brushes and a ride cymbal, a piano lays soft
 * chords on top, and a muted trumpet takes a phrase every other time round, so the loop doesn't wear.
 *
 * Only the board and the home screen play it: ten phones playing their own copies out of step would
 * be noise. It has its own level on each device (`levels.ts`). Loud game sounds (a shot, the closing
 * sting) push it down for a moment.
 */
import { gainOf, subscribeLevels } from './levels'
import { burst, onLoudSound, sharedAudio } from './sound'

/** The music's level under the game sounds. */
const VOLUME = 0.24
/** How far the music drops while a loud sound plays. */
const DUCKED = 0.3
const BPM = 66
const BEAT = 60 / BPM
const BEATS_PER_BAR = 4
/** How far ahead bars are written to the audio clock, so a busy page never leaves a gap. */
const AHEAD_S = 1.2
const TICK_MS = 250
/** A screen that hands the music to the next one (the home screen opening a room) keeps it playing. */
const HANDOVER_MS = 400

// ---------- The tune: eight bars in D minor, written for this game ----------

/** MIDI note numbers as frequencies. */
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

interface Bar {
  /** Four walking quarter notes. */
  readonly bass: readonly number[]
  /** A rootless piano voicing. */
  readonly chord: readonly number[]
}

/** Dm9, Bbmaj7, Em7b5, A7b9, Dm9, Gm9, Em7b5, A7alt: each bass line walks into the next chord. */
const BARS: readonly Bar[] = [
  { bass: [38, 41, 43, 45], chord: [53, 57, 60, 64] },
  { bass: [46, 45, 43, 41], chord: [57, 60, 62, 65] },
  { bass: [40, 43, 46, 44], chord: [55, 58, 62, 64] },
  { bass: [45, 43, 40, 39], chord: [55, 58, 61, 64] },
  { bass: [38, 40, 41, 42], chord: [53, 57, 60, 64] },
  { bass: [43, 46, 45, 41], chord: [53, 57, 58, 62] },
  { bass: [40, 46, 43, 44], chord: [55, 58, 62, 64] },
  { bass: [45, 41, 40, 39], chord: [55, 61, 65, 70] },
]

/** [bar, beat, MIDI note, length in beats]; swung eighths fall on the third of a beat. */
type Note = readonly [number, number, number, number]

const PHRASE_A: readonly Note[] = [
  [0, 1, 69, 1],
  [0, 2, 72, 0.67],
  [0, 2.67, 74, 1.33],
  [1, 0, 69, 2.5],
  [1, 3, 67, 0.67],
  [1, 3.67, 65, 0.33],
  [2, 0, 64, 1.5],
  [2, 2, 67, 1],
  [2, 3, 70, 1],
  [3, 0, 69, 0.67],
  [3, 0.67, 70, 0.33],
  [3, 1, 73, 2],
  [4, 0, 74, 3],
  [5, 1, 74, 0.67],
  [5, 1.67, 72, 0.33],
  [5, 2, 70, 1],
  [5, 3, 69, 1],
  [6, 0, 67, 1],
  [6, 1, 70, 1],
  [6, 2, 67, 2],
  [7, 0, 65, 0.67],
  [7, 0.67, 63, 0.33],
  [7, 1, 61, 2.5],
]

const PHRASE_B: readonly Note[] = [
  [0, 2, 74, 0.67],
  [0, 2.67, 76, 0.33],
  [0, 3, 77, 1],
  [1, 0, 76, 2],
  [1, 2, 74, 1],
  [3, 1, 73, 0.67],
  [3, 1.67, 70, 0.33],
  [3, 2, 69, 2],
  [5, 2, 70, 0.67],
  [5, 2.67, 69, 0.33],
  [5, 3, 65, 1],
  [6, 0, 64, 3],
  [7, 2, 61, 1],
  [7, 3, 64, 1],
]

/** The trumpet's part, time round after time round: a phrase, a rest, the answer, a rest. */
const PHRASES: readonly (readonly Note[] | undefined)[] = [PHRASE_A, undefined, PHRASE_B, undefined]

// ---------- The band ----------

/**
 * An upright bass: a plucked sine with a little of its octave, darkened. The note rings on, softening,
 * until the next one, as a walking line does.
 */
function bass(ctx: AudioContext, out: AudioNode, at: number, midi: number): void {
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(0.4, at + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.12, at + BEAT * 0.85)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + BEAT * 0.99)
  filter.connect(amp)
  amp.connect(out)
  for (const [ratio, wave] of [
    [1, 'sine'],
    [2, 'triangle'],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.setValueAtTime(hz(midi) * ratio, at)
    osc.connect(filter)
    osc.start(at)
    osc.stop(at + BEAT)
  }
}

/** A soft piano chord: each note a sine and a quiet triangle, fading as it rings. */
function piano(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  notes: readonly number[],
  beats: number,
) {
  const length = beats * BEAT
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(0.075, at + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + length)
  amp.connect(out)
  for (const note of notes) {
    for (const [wave, level] of [
      ['sine', 1],
      ['triangle', 0.35],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = wave
      osc.frequency.setValueAtTime(hz(note), at)
      const voice = ctx.createGain()
      voice.gain.value = level
      osc.connect(voice)
      voice.connect(amp)
      osc.start(at)
      osc.stop(at + length + 0.05)
    }
  }
}

/** A muted trumpet: a buzzy saw through a narrow, nasal filter, with a slow vibrato. */
function trumpet(ctx: AudioContext, out: AudioNode, at: number, midi: number, beats: number) {
  const length = beats * BEAT * 0.94
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(hz(midi), at)
  const vibrato = ctx.createOscillator()
  vibrato.frequency.value = 5.2
  const depth = ctx.createGain()
  depth.gain.setValueAtTime(0, at)
  depth.gain.linearRampToValueAtTime(hz(midi) * 0.006, at + Math.min(length, 0.5))
  vibrato.connect(depth)
  depth.connect(osc.frequency)
  const mute = ctx.createBiquadFilter()
  mute.type = 'bandpass'
  mute.frequency.value = 1300
  mute.Q.value = 2.2
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(0.22, at + 0.06)
  amp.gain.setValueAtTime(0.2, at + Math.max(0.07, length - 0.12))
  amp.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(mute)
  mute.connect(amp)
  amp.connect(out)
  for (const source of [osc, vibrato]) {
    source.start(at)
    source.stop(at + length + 0.05)
  }
}

/**
 * Brushes and a ride: the brush circles the snare all bar long, slaps it on two and four, and the
 * cymbal rings on every beat with its swung skip before two and four.
 */
function drums(ctx: AudioContext, out: AudioNode, at: number): void {
  for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
    const on = at + beat * BEAT
    burst(ctx, out, on, {
      duration: 0.55,
      from: 6200,
      to: 4800,
      q: 0.9,
      gain: 0.1,
      filter: 'highpass',
    })
    burst(ctx, out, on, { duration: BEAT * 1.15, from: 2400, to: 3600, q: 0.6, gain: 0.05 })
    if (beat % 2 === 1) {
      burst(ctx, out, on, { duration: 0.14, from: 3200, to: 1600, q: 0.7, gain: 0.12 })
      burst(ctx, out, on - BEAT * 0.33, {
        duration: 0.22,
        from: 6200,
        to: 5000,
        q: 0.9,
        gain: 0.06,
        filter: 'highpass',
      })
    }
  }
}

/** Writes bar [n] of the loop, starting at [at] on the audio clock. */
function playBar(ctx: AudioContext, out: AudioNode, at: number, n: number): void {
  const index = n % BARS.length
  const bar = BARS[index]
  bar.bass.forEach((note, beat) => bass(ctx, out, at + beat * BEAT, note))
  piano(ctx, out, at, bar.chord, 1.5)
  piano(ctx, out, at + BEAT * 1.67, bar.chord, 0.6)
  drums(ctx, out, at)
  const phrase = PHRASES[Math.floor(n / BARS.length) % PHRASES.length]
  for (const [inBar, beat, note, beats] of phrase ?? []) {
    if (inBar === index) trumpet(ctx, out, at + beat * BEAT, note, beats)
  }
}

// ---------- Playing it ----------

/** How many screens want the music now. */
let wanted = 0
let stopTimer: ReturnType<typeof setTimeout> | undefined
let band: Band | undefined

interface Band {
  readonly ctx: AudioContext
  readonly bus: GainNode
  readonly stopListening: () => void
  timer?: ReturnType<typeof setTimeout>
  next?: number
  bar: number
}

/** Asks for the music on this screen; the returned function gives it up. */
export function startMusic(): () => void {
  wanted++
  clearTimeout(stopTimer)
  update()
  let given = false
  return () => {
    if (given) return
    given = true
    wanted--
    clearTimeout(stopTimer)
    stopTimer = setTimeout(update, HANDOVER_MS)
  }
}

/** Starts or stops the band to match what's wanted and how loud the music may be. */
function update(): void {
  const play = wanted > 0 && gainOf('music') > 0
  if (play && !band) begin()
  else if (!play && band) end()
}

// A band already playing follows its slider; one that just started fades in to it anyway.
subscribeLevels(() => {
  const playing = band
  update()
  if (band && band === playing) {
    const now = band.ctx.currentTime
    band.bus.gain.cancelScheduledValues(now)
    band.bus.gain.setTargetAtTime(level(), now, 0.05)
  }
})

/** The music's volume now: the mix's level times this device's slider. */
const level = () => VOLUME * gainOf('music')

function begin(): void {
  const audio = sharedAudio()
  if (!audio) return
  const ctx = audio.context
  const bus = ctx.createGain()
  bus.gain.setValueAtTime(0.0001, ctx.currentTime)
  bus.gain.exponentialRampToValueAtTime(level(), ctx.currentTime + 2)
  bus.connect(audio.output)
  const stopListening = onLoudSound(() => duck(bus, ctx))
  // Browsers keep audio off until someone touches the page: the first touch starts the band.
  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)
  }
  document.addEventListener('pointerdown', wake)
  document.addEventListener('keydown', wake)
  band = {
    ctx,
    bus,
    bar: 0,
    stopListening: () => {
      stopListening()
      document.removeEventListener('pointerdown', wake)
      document.removeEventListener('keydown', wake)
    },
  }
  tick(band)
}

/** Writes the bars due in the next moment, then comes back. */
function tick(b: Band): void {
  if (b.ctx.state === 'running') {
    b.next ??= b.ctx.currentTime + 0.1
    while (b.next < b.ctx.currentTime + AHEAD_S) {
      playBar(b.ctx, b.bus, b.next, b.bar++)
      b.next += BEATS_PER_BAR * BEAT
    }
  }
  b.timer = setTimeout(() => tick(b), TICK_MS)
}

/** Fades the band out; what was already written to the clock plays on into silence. */
function end(): void {
  const b = band as Band
  band = undefined
  clearTimeout(b.timer)
  b.stopListening()
  const now = b.ctx.currentTime
  b.bus.gain.cancelScheduledValues(now)
  b.bus.gain.setTargetAtTime(0, now, 0.25)
  setTimeout(() => b.bus.disconnect(), 2000)
}

/** Steps the music back while a loud sound plays, then brings it up again. */
function duck(bus: GainNode, ctx: AudioContext): void {
  const now = ctx.currentTime
  bus.gain.cancelScheduledValues(now)
  bus.gain.setTargetAtTime(level() * DUCKED, now, 0.04)
  bus.gain.setTargetAtTime(level(), now + 1.6, 0.6)
}

/** Stops everything and forgets it, so each test starts quiet. */
export function resetMusicForTests(): void {
  if (band) end()
  wanted = 0
  clearTimeout(stopTimer)
}
