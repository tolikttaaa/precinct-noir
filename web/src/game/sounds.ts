import type { ShadowDuelEvent } from '../protocol/generated'
import type { Cue, Cues } from '../sound/useEventSounds'
import { SHADOW_DUEL } from './shadowDuel/moves'

/**
 * What the room hears for each public Shadow Duel event. The sounds follow only what everyone can see;
 * private events (the cards in your own hand) stay silent.
 */
export function duelCues(event: unknown): readonly Cue[] {
  const e = event as ShadowDuelEvent
  switch (e.t) {
    case 'game_started':
      return [['stamp', 0]]
    case 'killed':
      return [['shot', 0]]
    case 'accused':
      return [['slam', 0]]
    case 'shifted':
      return [['slide', 0]]
    case 'collapsed':
      return [['rumble', 0]]
    case 'disguised':
      // A new face; when the old one is cleared in public, its card is stamped.
      return e.exonerated === undefined
        ? [['coat', 0]]
        : [
            ['coat', 0],
            ['stamp', 0.45],
          ]
    case 'exonerated':
      // The card was just drawn (with its own sound): it is stamped onto the board, or discarded.
      return e.placed ? [['stamp', 0]] : [['deal', 0]]
    case 'cards_drawn':
      return Array.from({ length: Math.min(e.count, 4) }, (_, i): Cue => ['deal', i * 0.12])
    case 'identity_chosen':
      return [['deal', 0]]
    case 'nudged':
      return [['clock', 0]]
    case 'game_over':
      return [[e.outcome.reason === 'killer_caught' ? 'caseClosed' : 'killerWins', 0.25]]
    default:
      return []
  }
}

/** The event sounds for [mode], if it has any. */
export function cuesFor(mode: string | undefined): Cues | undefined {
  return mode === SHADOW_DUEL ? duelCues : undefined
}
