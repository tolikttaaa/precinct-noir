import { useTranslation } from 'react-i18next'
import { Masthead } from '../components/Chrome'
import { Stamp } from '../components/Stamp'
import { modeName } from '../i18n/text'
import type { Ending } from '../net/roomSocket'
import type { RoomView } from '../protocol/generated'

/** Shown until the room's first state arrives. */
export function Connecting({ code }: { code: string }) {
  const { t } = useTranslation()
  return (
    <div className="screen screen--plain">
      <Masthead code={code} />
      <main className="plain">
        <p className="plain__title" role="status">
          {t('connection.connecting')}
        </p>
      </main>
    </div>
  )
}

/** This device is out of the room; [action] says where to go next. */
export function Ended({
  code,
  ending,
  action,
}: {
  code: string
  ending: Ending
  action: { label: string; run: () => void }
}) {
  const { t } = useTranslation()
  return (
    <div className="screen screen--plain">
      <Masthead code={code} />
      <main className="plain">
        <h1 className="plain__title">{t(`endings.${ending}`, { code })}</h1>
        <button type="button" className="button" onClick={action.run}>
          {action.label}
        </button>
      </main>
    </div>
  )
}

/** While a game runs (its board arrives in M5). */
export function GameUnderway({ room, seated }: { room: RoomView; seated?: boolean }) {
  const { t } = useTranslation()
  return (
    <section className="underway" aria-labelledby="underway-title">
      <h1 id="underway-title" className="underway__title">
        {t('game.inProgress', { mode: modeName(t, room.mode) })}
      </h1>
      <p className="hint">{t('game.round', { round: room.round })}</p>
      {seated !== undefined && <p>{seated ? t('game.seat') : t('game.spectator')}</p>}
      <p className="hint">{t('game.boardPending')}</p>
    </section>
  )
}

/** After a game: how it ended. */
export function RoundOver({ room }: { room: RoomView }) {
  const { t } = useTranslation()
  return (
    <section className="round-over" aria-labelledby="round-over-title">
      <h1 id="round-over-title" className="round-over__title">
        <Stamp>{t('game.over')}</Stamp>
      </h1>
      {room.lastResult && <p>{t(`results.${room.lastResult.kind}`)}</p>}
    </section>
  )
}
