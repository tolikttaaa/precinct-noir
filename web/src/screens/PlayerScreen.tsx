import { useEffect, useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ConnectionNotice, Flash, Masthead } from '../components/Chrome'
import { ConfirmButton } from '../components/ConfirmButton'
import { Lineup } from '../components/Lineup'
import { playingIds } from '../components/seats'
import { RoomRules } from '../components/RoomRules'
import { GuideSheet } from '../game/Guide'
import { hasGuide } from '../game/guides'
import { DuelPhone } from '../game/shadowDuel/DuelPhone'
import { duelOf } from '../game/shadowDuel/moves'
import { useModes } from '../hooks/useModes'
import { cuesFor } from '../game/sounds'
import { useRoom } from '../hooks/useRoom'
import { errorText, modeName } from '../i18n/text'
import { api } from '../net/api'
import {
  forgetCredentials,
  loadCredentials,
  saveCredentials,
  type Credentials,
} from '../net/credentials'
import type { RoomSummary } from '../protocol/generated'
import { navigate } from '../routing'
import { useEventSounds } from '../sound/useEventSounds'
import { Connecting, Ended, GameUnderway, RoundOver, StoppedEarly } from './RoomParts'

/** A player's phone at `/CODE`: the join form, then the room. */
export function PlayerScreen({ code }: { code: string }) {
  const [credentials, setCredentials] = useState(() => loadCredentials(code, 'player'))
  if (!credentials) return <JoinForm code={code} onJoined={setCredentials} />
  return <PlayerRoom code={code} credentials={credentials} onRejoin={() => setCredentials(null)} />
}

function JoinForm({
  code,
  onJoined,
}: {
  code: string
  onJoined: (credentials: Credentials) => void
}) {
  const { t } = useTranslation()
  const [summary, setSummary] = useState<RoomSummary>()
  const [lookupError, setLookupError] = useState<string>()
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string>()
  const nameId = useId()

  useEffect(() => {
    let live = true
    api.summary(code).then(
      (room) => live && setSummary(room),
      (error: unknown) => live && setLookupError(errorText(t, error, code)),
    )
    return () => {
      live = false
    }
  }, [code, t])

  async function join(event: FormEvent) {
    event.preventDefault()
    setJoining(true)
    setJoinError(undefined)
    try {
      const joined = await api.join(code, name.trim())
      const credentials = { token: joined.playerToken, playerId: joined.playerId, clientSeq: 0 }
      saveCredentials(code, 'player', credentials)
      onJoined(credentials)
    } catch (error) {
      setJoinError(errorText(t, error, code))
      setJoining(false)
    }
  }

  return (
    <div className="screen screen--phone">
      <Masthead code={code} />
      <main>
        <form
          className="file file--register"
          onSubmit={(e) => void join(e)}
          aria-labelledby="join-room-title"
        >
          <h1 id="join-room-title" className="file__tab">
            {t('join.title', { code })}
          </h1>
          <p className="hint" role="status">
            {lookupError ??
              (summary
                ? summary.status === 'in_game'
                  ? t('errors.room_locked')
                  : t('join.waiting', { count: summary.players })
                : t('join.checking'))}
          </p>
          <div className="field">
            <label className="field__label" htmlFor={nameId}>
              {t('join.name')}
            </label>
            <input
              id={nameId}
              className="typed"
              value={name}
              maxLength={16}
              autoComplete="nickname"
              aria-describedby={`${nameId}-hint`}
              onChange={(e) => setName(e.target.value)}
            />
            <span id={`${nameId}-hint`} className="hint">
              {t('join.nameHint')}
            </span>
          </div>
          <button type="submit" className="button" disabled={joining || name.trim() === ''}>
            {joining ? t('join.working') : t('join.action')}
          </button>
          {joinError && (
            <p className="message message--error" role="alert">
              {joinError}
            </p>
          )}
        </form>
      </main>
    </div>
  )
}

function PlayerRoom({
  code,
  credentials,
  onRejoin,
}: {
  code: string
  credentials: Credentials
  onRejoin: () => void
}) {
  const { t } = useTranslation()
  const { state, send } = useRoom(code, 'player', credentials)
  const modes = useModes()
  const [guideOpen, setGuideOpen] = useState(false)
  // Phones stay quiet while a board plays the game's sounds for the room; without one, each phone
  // plays them itself (players on a call, each at home).
  useEventSounds(
    state.events,
    state.replayedTo,
    cuesFor(state.game?.mode),
    state.room?.hostConnected === false,
  )

  useEffect(() => {
    if (state.ending) forgetCredentials(code, 'player')
  }, [code, state.ending])

  if (state.ending) {
    const rejoin = state.ending === 'kicked' || state.ending === 'bad_token'
    return (
      <Ended
        code={code}
        ending={state.ending}
        action={
          rejoin
            ? { label: t('endings.joinAgain'), run: onRejoin }
            : { label: t('endings.home'), run: () => navigate('/') }
        }
      />
    )
  }
  const room = state.room
  if (!room) return <Connecting code={code} />

  const me = state.you?.playerId
  const isVip = me !== undefined && room.vip === me
  const mode = modes?.find((m) => m.id === room.mode)
  const max = mode?.maxPlayers ?? room.members.length
  const playing = playingIds(room.members, room.seats, max)
  const missing = Math.max(0, (mode?.minPlayers ?? 0) - Math.min(room.members.length, max))
  const vipName = room.members.find((m) => m.id === room.vip)?.name ?? ''
  const duel = duelOf(state, room)
  const roomButtons = (
    <>
      {room.status === 'in_game' && isVip && (
        <ConfirmButton
          label={t('game.endGame')}
          confirmLabel={t('game.endConfirm')}
          onConfirm={() => send({ t: 'end_game' })}
        />
      )}
      {room.status === 'finished' &&
        (isVip ? (
          <button type="button" className="button" onClick={() => send({ t: 'play_again' })}>
            {t('game.playAgain')}
          </button>
        ) : (
          <p className="action-bar__status">{t('game.waitingForRematch', { name: vipName })}</p>
        ))}
      {room.status !== 'in_game' && (
        <ConfirmButton
          label={t('lobby.leave')}
          confirmLabel={t('lobby.leaveConfirm')}
          onConfirm={() => send({ t: 'leave' })}
        />
      )}
    </>
  )
  const lobby = guideOpen ? (
    <GuideSheet
      mode={room.mode}
      onClose={() => setGuideOpen(false)}
      board={
        isVip
          ? {
              showing: room.guide !== undefined,
              show: (page) => send(page === null ? { t: 'show_guide' } : { t: 'show_guide', page }),
            }
          : undefined
      }
    />
  ) : (
    <>
      <StoppedEarly room={room} />
      {isVip && <p className="lede">{t('lobby.youAreVip')}</p>}
      <Lineup
        members={room.members}
        playing={playing}
        vip={room.vip}
        you={me}
        mode={{ name: modeName(t, room.mode), players: max }}
        onRemove={isVip ? (playerId) => send({ t: 'kick', playerId }) : undefined}
      />
      {hasGuide(room.mode) && (
        <div className="lobby-guide">
          <button type="button" className="button button--quiet" onClick={() => setGuideOpen(true)}>
            {t('duel.howToPlay')}
          </button>
          {!isVip && room.guide !== undefined && (
            <p className="hint">{t('guide.onBoard', { name: vipName })}</p>
          )}
        </div>
      )}
      {modes && <RoomRules room={room} modes={modes} editable={isVip} send={send} />}
      {!room.hostConnected && <p className="hint">{t('lobby.boardOffline')}</p>}
    </>
  )

  return (
    <div className="screen screen--phone">
      <Masthead code={code} />
      <ConnectionNotice connection={state.connection} />
      {duel ? (
        <DuelPhone
          room={room}
          duel={duel}
          send={send}
          refusalId={state.refusal?.id ?? 0}
          footer={roomButtons}
        />
      ) : (
        <>
          <main className="room">
            {room.status === 'lobby' && lobby}
            {room.status === 'in_game' && (
              <GameUnderway room={room} seated={me !== undefined && playing.has(me)} />
            )}
            {room.status === 'finished' && <RoundOver room={room} />}
          </main>
          {/* The rules bring their own bar. */}
          {!(room.status === 'lobby' && guideOpen) && (
            <footer className="action-bar">
              {room.status === 'lobby' &&
                (isVip ? (
                  <button
                    type="button"
                    className="button"
                    disabled={missing > 0}
                    onClick={() => send({ t: 'start' })}
                  >
                    {missing > 0 ? t('lobby.needMore', { count: missing }) : t('lobby.start')}
                  </button>
                ) : (
                  <p className="action-bar__status">
                    {t('lobby.waitingForVip', { name: vipName })}
                  </p>
                ))}
              {roomButtons}
            </footer>
          )}
        </>
      )}
      <Flash
        id={state.refusal?.id ?? 0}
        message={state.refusal && t(`refusals.${state.refusal.reason}`)}
      />
      <Flash id={state.nudges} message={state.nudges > 0 ? t('game.nudge') : undefined} />
      {state.error && (
        <p className="message message--error" role="alert">
          {t('errors.unexpected')}
        </p>
      )}
    </div>
  )
}
