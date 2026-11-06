import { useTranslation } from 'react-i18next'
import type { MemberView } from '../protocol/generated'
import { ConfirmButton } from './ConfirmButton'
import { Stamp } from './Stamp'

interface Props {
  readonly members: readonly MemberView[]
  /** Member ids who play this round; everyone else watches. */
  readonly playing: ReadonlySet<number>
  readonly vip?: number
  readonly you?: number
  /** The mode's name and player count, to explain who watches. */
  readonly mode: { readonly name: string; readonly players: number }
  /** Shown to the VIP in the lobby: remove another player. */
  readonly onRemove?: (id: number) => void
}

/** The line-up wall: who is in the room, in the order they joined, which decides who plays. */
export function Lineup({ members, playing, vip, you, mode, onRemove }: Props) {
  const { t } = useTranslation()
  const players = members.filter((m) => playing.has(m.id))
  const watchers = members.filter((m) => !playing.has(m.id))
  const row = (member: MemberView) => (
    <li key={member.id} className="suspect" data-offline={!member.connected || undefined}>
      <span className="suspect__name">{member.name}</span>
      <span className="suspect__marks">
        {member.id === vip && <Stamp tone="brass">{t('lobby.vip')}</Stamp>}
        {member.id === you && <span className="suspect__you">{t('lobby.you')}</span>}
        {!member.connected && <span className="suspect__offline">{t('lobby.offline')}</span>}
      </span>
      {onRemove && member.id !== you && (
        <ConfirmButton
          className="button button--small button--quiet"
          label={t('lobby.remove')}
          confirmLabel={t('lobby.removeConfirm', { name: member.name })}
          onConfirm={() => onRemove(member.id)}
        />
      )}
    </li>
  )
  return (
    <section className="lineup" aria-labelledby="lineup-title">
      <h2 id="lineup-title" className="section-title">
        {t('lobby.players')}
      </h2>
      {members.length === 0 ? (
        <p className="lineup__empty">{t('lobby.empty')}</p>
      ) : (
        <ol className="lineup__wall">{players.map(row)}</ol>
      )}
      {watchers.length > 0 && (
        <>
          <h3 className="section-title section-title--minor">{t('lobby.watching')}</h3>
          <ul className="lineup__watchers">{watchers.map(row)}</ul>
          <p className="hint">
            {t('lobby.watchingHint', { mode: mode.name, count: mode.players })}
          </p>
        </>
      )}
    </section>
  )
}
