/**
 * How loud each kind of sound is on this device: the music, and the effects (every other sound). Each
 * has a level from 0 to 100 and a mute that keeps the level for when it comes back. Remembered per
 * device.
 */
export type Channel = 'music' | 'effects'

export interface Level {
  readonly level: number
  readonly muted: boolean
}

/** Where the sliders start: at this level a channel plays as the game was mixed. */
export const DEFAULT_LEVEL = 70

const DEFAULT: Level = { level: DEFAULT_LEVEL, muted: false }
const key = (channel: Channel) => `precinctnoir.volume.${channel}`

const levels = new Map<Channel, Level>()
const listeners = new Set<() => void>()

/** [channel]'s level and mute (the same object until it changes, as React's stores need). */
export function levelOf(channel: Channel): Level {
  let level = levels.get(channel)
  if (!level) {
    level = read(channel)
    levels.set(channel, level)
  }
  return level
}

/** Sets [channel]'s level; moving it also unmutes. */
export function setLevel(channel: Channel, level: number): void {
  save(channel, { level: clamp(level), muted: false })
}

/** Mutes or unmutes [channel]; unmuting a channel turned right down brings it back to the start level. */
export function setMuted(channel: Channel, muted: boolean): void {
  const { level } = levelOf(channel)
  save(channel, { level: !muted && level === 0 ? DEFAULT_LEVEL : level, muted })
}

/**
 * [channel]'s gain against the game's own mix: 1 at the start level, silent at 0 or muted, about twice
 * as loud (+6 dB) at 100. Squaring the level follows how loud it sounds rather than the raw amplitude.
 */
export function gainOf(channel: Channel): number {
  const { level, muted } = levelOf(channel)
  return muted ? 0 : (level / DEFAULT_LEVEL) ** 2
}

export function subscribeLevels(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Forgets the levels read so far, so each test starts from storage. */
export function resetLevelsForTests(): void {
  levels.clear()
}

function clamp(level: number): number {
  return Math.min(100, Math.max(0, Math.round(level)))
}

function read(channel: Channel): Level {
  try {
    const saved = JSON.parse(localStorage.getItem(key(channel)) ?? 'null') as Partial<Level> | null
    const level = Number(saved?.level)
    if (Number.isFinite(level)) return { level: clamp(level), muted: saved?.muted === true }
  } catch {
    // Blocked or unreadable storage: the defaults.
  }
  return DEFAULT
}

function save(channel: Channel, level: Level): void {
  levels.set(channel, level)
  try {
    localStorage.setItem(key(channel), JSON.stringify(level))
  } catch {
    // The choice lasts for this page only.
  }
  listeners.forEach((listener) => listener())
}
