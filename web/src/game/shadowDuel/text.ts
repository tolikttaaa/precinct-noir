import type { TFunction } from 'i18next'
import type { RoomView, ShadowDuelEvent, ShadowDuelView } from '../../protocol/generated'
import { direction } from '../motion'
import { genderOf, suspectName } from '../suspects'
import { seatName } from './moves'

type Prompt = 'opening_kill' | 'choose_identity' | 'turn' | 'exonerate_discard' | 'collapse_more'

/** Events that only this device saw; phones keep them out of the visible log, the file shows them. */
const PRIVATE = new Set<ShadowDuelEvent['t']>(['you_drew', 'your_identity'])

/** One case-log line for [event], or `null` for events that only move the turn along. */
export function logLine(
  t: TFunction,
  language: string,
  room: RoomView,
  event: ShadowDuelEvent,
): string | null {
  const name = (id: number) => suspectName(id, language)
  const player = (seat: number) => seatName(room, seat)
  switch (event.t) {
    case 'game_started':
      return t('duel.log.game_started', {
        killer: player(event.killer),
        inspector: player(event.inspector),
      })
    case 'killed': {
      const line = t('duel.log.killed', {
        victim: name(event.victim),
        context: genderOf(event.victim),
      })
      if (event.inspectorAdjacent === undefined) return line
      return `${line} ${t(event.inspectorAdjacent ? 'duel.log.inspectorNear' : 'duel.log.inspectorFar')}`
    }
    case 'shifted':
      return t(`duel.log.shifted_${event.line.axis}`, {
        player: player(event.seat),
        n: event.line.index + 1,
        dir: t(`duel.dir.${direction(event.line, event.by)}`),
      })
    case 'collapsed':
      return t('duel.log.collapsed', {
        player: player(event.seat),
        names: event.removed.map(name).join(', '),
      })
    case 'disguised':
      if (event.exonerated !== undefined) {
        return t('duel.log.disguised', { name: name(event.exonerated) })
      }
      return event.discarded === undefined
        ? null
        : t('duel.log.disguiseFailed', {
            name: name(event.discarded),
            context: genderOf(event.discarded),
          })
    case 'exonerated': {
      const card = name(event.card)
      const line = event.placed
        ? t('duel.log.cleared', { player: player(event.seat), name: card })
        : t('duel.log.clearedDead', {
            player: player(event.seat),
            name: card,
            context: genderOf(event.card),
          })
      if (event.killerAdjacent === undefined) return line
      return `${line} ${t(event.killerAdjacent ? 'duel.log.killerNear' : 'duel.log.killerFar', { name: card })}`
    }
    case 'accused':
      return t(event.correct ? 'duel.log.caught' : 'duel.log.accused', {
        player: player(event.seat),
        name: name(event.target),
      })
    case 'identity_chosen':
      return t('duel.log.identityChosen', { player: player(event.seat) })
    case 'cards_drawn':
      return t('duel.log.cardsDrawn', { player: player(event.seat), count: event.count })
    case 'you_drew':
      return t('duel.log.youDrew', { names: event.cards.map(name).join(', ') })
    case 'your_identity':
      return t('duel.log.yourIdentity', { name: name(event.card) })
    case 'nudged':
      return t('duel.log.nudged', { player: player(event.seat) })
    case 'turn_started':
    case 'game_over':
      return null
  }
}

/** The case log, newest first, at most [limit] lines; [publicOnly] drops this device's private draws. */
export function caseLog(
  t: TFunction,
  language: string,
  room: RoomView,
  events: readonly ShadowDuelEvent[],
  limit: number,
  publicOnly: boolean,
): string[] {
  const lines: string[] = []
  for (let i = events.length - 1; i >= 0 && lines.length < limit; i--) {
    const event = events[i]
    if (publicOnly && PRIVATE.has(event.t)) continue
    const line = logLine(t, language, room, event)
    if (line !== null) lines.push(line)
  }
  return lines
}

/** What the board says is happening: who must decide what. */
export function promptText(t: TFunction, room: RoomView, view: ShadowDuelView): string {
  const pending = view.pending
  if (!pending) return ''
  return t(`duel.prompt.${pending.prompt as Prompt}`, { name: seatName(room, pending.actor) })
}

/** What this player's phone says when the decision is theirs. */
export function yourPromptText(t: TFunction, view: ShadowDuelView): string {
  return view.pending ? t(`duel.yourPrompt.${view.pending.prompt as Prompt}`) : ''
}
