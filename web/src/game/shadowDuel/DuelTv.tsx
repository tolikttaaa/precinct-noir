import { useTranslation } from 'react-i18next'
import type { RoomView } from '../../protocol/generated'
import { Board } from '../Board'
import { suspectName } from '../suspects'
import type { DuelGame } from './moves'
import { CaseLog, DuelSeats, KillMeter, Outcome } from './parts'
import { promptText } from './text'

/** The board screen during a Shadow Duel: the city, who's who, the tally and the case log. */
export function DuelTv({
  room,
  duel,
  status,
}: {
  room: RoomView
  duel: DuelGame
  status?: string
}) {
  const { t, i18n } = useTranslation()
  const { view, events } = duel
  return (
    <main className="duel-tv">
      <section className="duel-tv__city">
        <Board
          size="tv"
          rows={view.board.rows}
          cols={view.board.cols}
          tiles={view.board.tiles}
          lastShift={view.lastShift}
          labels
        />
      </section>
      <aside className="duel-tv__side slate">
        <DuelSeats room={room} view={view} />
        <p className="duel-tv__turn">{t('duel.turn', { turn: view.turn })}</p>
        <KillMeter view={view} />
        {view.outcome ? (
          <Outcome room={room} view={view} outcome={view.outcome} />
        ) : (
          <p className="duel-tv__prompt" role="status">
            {promptText(t, room, view)}
          </p>
        )}
        {status && <p className="tv__status">{status}</p>}
        <CaseLog room={room} events={events} limit={view.outcome ? 2 : 6} publicOnly />
        <p className="hint">{t('duel.deck', { count: view.deckCount })}</p>
        {view.discard.length > 0 && (
          <p className="hint">
            {t('duel.faceUp')}:{' '}
            {view.discard.map((id) => suspectName(id, i18n.language)).join(', ')}
          </p>
        )}
      </aside>
    </main>
  )
}
