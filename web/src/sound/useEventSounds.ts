import { useEffect, useRef } from 'react'
import type { EventView } from '../protocol/generated'
import { play, type SoundName } from './sound'

/** A sound, and how many seconds after its event it plays. */
export type Cue = readonly [SoundName, number]

/** The sounds a game event makes in the room. */
export type Cues = (event: unknown) => readonly Cue[]

/** The pause after one event's sounds before the next event in the same moment is heard. */
const GAP_S = 0.4

/**
 * Plays the sounds of a game's events as they happen. Events already there when the screen opened, and
 * those caught up on when reconnecting, stay silent: nobody wants a volley of old shots on a reload.
 */
export function useEventSounds(
  events: readonly EventView[],
  replayedTo: number,
  cues: Cues | undefined,
  enabled: boolean,
): void {
  const heard = useRef(events.at(-1)?.seq ?? 0)
  useEffect(() => {
    const fresh = events.filter((e) => e.seq > heard.current && e.seq > replayedTo)
    heard.current = Math.max(heard.current, events.at(-1)?.seq ?? 0)
    if (!enabled || !cues) return
    let at = 0
    for (const { event } of fresh) {
      const sounds = cues(event)
      if (sounds.length === 0) continue
      for (const [name, after] of sounds) play(name, at + after)
      at += Math.max(...sounds.map(([, after]) => after)) + GAP_S
    }
  }, [events, replayedTo, cues, enabled])
}
