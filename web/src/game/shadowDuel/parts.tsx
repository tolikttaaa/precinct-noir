import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Stamp } from '../../components/Stamp'
import type { RoomView, ShadowDuelEvent, ShadowDuelView } from '../../protocol/generated'
import { SuspectCard } from '../SuspectCard'
import { suspectName } from '../suspects'
import { seatName } from './moves'
import { caseLog } from './text'

/** Who plays which side, and whose move it is. Roles are public in Shadow Duel. */
export function DuelSeats({ room, view }: { room: RoomView; view: ShadowDuelView }) {
  const { t } = useTranslation()
  const moving = view.outcome === undefined ? view.pending?.actor : undefined
  return (
    <ul className="duel-seats">
      {view.seats.map((s) => (
        <li key={s.seat} className="duel-seats__seat" data-moving={s.seat === moving || undefined}>
          <Stamp tone={s.role === 'killer' ? 'red' : 'blue'}>{t(`duel.role.${s.role}`)}</Stamp>
          <span className="duel-seats__name">{seatName(room, s.seat)}</span>
        </li>
      ))}
    </ul>
  )
}

/** The killer's tally: one stroke per kill, out of the kills that win. */
export function KillMeter({ view }: { view: ShadowDuelView }) {
  const { t } = useTranslation()
  return (
    <div className="kill-meter">
      <p className="kill-meter__label">
        {t('duel.kills')}{' '}
        <span className="kill-meter__count">
          {t('duel.killsOf', { kills: view.kills, max: view.killsToWin })}
        </span>
      </p>
      <div className="kill-meter__tally" aria-hidden="true">
        {Array.from({ length: view.killsToWin }, (_, i) => (
          <span key={i} className="kill-meter__stroke" data-done={i < view.kills || undefined} />
        ))}
      </div>
    </div>
  )
}

interface LogProps {
  readonly room: RoomView
  readonly events: readonly ShadowDuelEvent[]
  readonly limit: number
  /** Leave out this device's private draws (they stay in the player's file). */
  readonly publicOnly?: boolean
}

/** The case log, newest first. */
export function CaseLog({ room, events, limit, publicOnly = false }: LogProps) {
  const { t, i18n } = useTranslation()
  const titleId = useId()
  const lines = caseLog(t, i18n.language, room, events, limit, publicOnly)
  return (
    <section className="case-log" aria-labelledby={titleId}>
      <h2 id={titleId} className="section-title section-title--minor">
        {t('duel.log.title')}
      </h2>
      {lines.length === 0 ? (
        <p className="hint">{t('duel.log.empty')}</p>
      ) : (
        <ol className="case-log__lines">
          {lines.map((line, i) => (
            <li key={`${events.length}-${i}`}>{line}</li>
          ))}
        </ol>
      )}
    </section>
  )
}

interface OutcomeProps {
  readonly room: RoomView
  readonly view: ShadowDuelView
  readonly outcome: NonNullable<ShadowDuelView['outcome']>
}

/** How the game ended, and who everyone really was. */
export function Outcome({ room, view, outcome }: OutcomeProps) {
  const { t, i18n } = useTranslation()
  const winners = outcome.winners.map((seat) => seatName(room, seat)).join(', ')
  const reason = outcome.reason as 'inspector_eliminated' | 'kill_quota' | 'killer_caught'
  return (
    <section className="outcome" aria-labelledby="outcome-title">
      <h2 id="outcome-title" className="outcome__title">
        <Stamp>{t('game.over')}</Stamp>{' '}
        <span className="outcome__winner">{t('duel.over.winner', { name: winners })}</span>
      </h2>
      <p className="outcome__reason">{t(`duel.over.reason.${reason}`, { max: view.killsToWin })}</p>
      {view.reveal && (
        <ul className="reveal">
          {view.reveal.seats.map((s) => (
            <li key={s.seat} className="reveal__seat">
              <p className="reveal__who">
                <Stamp tone={s.role === 'killer' ? 'red' : 'blue'}>
                  {t(`duel.role.${s.role}`)}
                </Stamp>
                <span>{seatName(room, s.seat)}</span>
              </p>
              {s.identity === undefined ? (
                <p className="hint">{t('duel.over.noIdentity')}</p>
              ) : (
                <SuspectCard id={s.identity} />
              )}
              {s.hand.length > 0 && (
                <p className="hint">
                  {t('duel.over.hand')}:{' '}
                  {s.hand.map((id) => suspectName(id, i18n.language)).join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
