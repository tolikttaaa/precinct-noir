import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConnectionNotice, Masthead } from '../components/Chrome'
import { Lineup } from '../components/Lineup'
import { playingIds } from '../components/seats'
import { Link } from '../components/Link'
import { QrCode } from '../components/QrCode'
import { useModes } from '../hooks/useModes'
import { useRoom } from '../hooks/useRoom'
import { modeName, modeSummary } from '../i18n/text'
import { forgetCredentials, loadCredentials, type Credentials } from '../net/credentials'
import { navigate } from '../routing'
import { Connecting, Ended, GameUnderway, RoundOver, StoppedEarly } from './RoomParts'

/** The board screen at `/tv/CODE`. Only the screen that opened the room has its host token. */
export function TvScreen({ code }: { code: string }) {
  const [credentials] = useState(() => loadCredentials(code, 'host'))
  return credentials ? <TvRoom code={code} credentials={credentials} /> : <NotHost code={code} />
}

function NotHost({ code }: { code: string }) {
  const { t } = useTranslation()
  return (
    <div className="screen screen--plain">
      <Masthead code={code} />
      <main className="plain">
        <h1 className="plain__title">{t('tv.notHost', { code })}</h1>
        <p>{t('tv.notHostHint')}</p>
        <Link to={`/${code}`} className="button">
          {t('tv.joinAsPlayer')}
        </Link>
      </main>
    </div>
  )
}

function TvRoom({ code, credentials }: { code: string; credentials: Credentials }) {
  const { t } = useTranslation()
  const { state } = useRoom(code, 'host', credentials)
  const modes = useModes()

  useEffect(() => {
    if (state.ending) forgetCredentials(code, 'host')
  }, [code, state.ending])

  if (state.ending) {
    return (
      <Ended
        code={code}
        ending={state.ending}
        action={{ label: t('endings.openRoom'), run: () => navigate('/') }}
      />
    )
  }
  const room = state.room
  if (!room) return <Connecting code={code} />

  const mode = modes?.find((m) => m.id === room.mode)
  const max = mode?.maxPlayers ?? room.members.length
  const vipName = room.members.find((m) => m.id === room.vip)?.name
  const address = `${window.location.host}/${code}`

  return (
    <div className="screen screen--tv">
      <Masthead />
      <ConnectionNotice connection={state.connection} />
      <main className="tv">
        {room.status === 'in_game' ? (
          <GameUnderway room={room} />
        ) : (
          <section className="folder" aria-labelledby="case-code">
            <h1 className="folder__tab" id="case-code">
              <span className="folder__label">{t('lobby.codeLabel')}</span>
            </h1>
            <div className="folder__front">
              <p className="case-number" aria-label={code.split('').join(' ')}>
                {code}
              </p>
              <div className="tv__join">
                <QrCode value={`${window.location.origin}/${code}`} label={t('lobby.scan')} />
                <div>
                  <p className="tv__address">{t('lobby.joinAt', { address })}</p>
                  <p className="hint">{t('lobby.scan')}</p>
                </div>
              </div>
            </div>
          </section>
        )}
        <div className="tv__side slate">
          {room.status === 'finished' && <RoundOver room={room} />}
          <StoppedEarly room={room} />
          <Lineup
            members={room.members}
            playing={playingIds(room.members, room.seats, max)}
            vip={room.vip}
            mode={{ name: modeName(t, room.mode), players: max }}
          />
          <p className="tv__status" role="status">
            {room.status === 'in_game'
              ? ''
              : vipName === undefined
                ? t('lobby.waitingForPlayers')
                : room.status === 'lobby'
                  ? t('lobby.waitingForVip', { name: vipName })
                  : t('game.waitingForRematch', { name: vipName })}
          </p>
          {room.status === 'lobby' && (
            <div className="tv__mode">
              <h2 className="section-title">{modeName(t, room.mode)}</h2>
              <p>{modeSummary(t, room.mode)}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
