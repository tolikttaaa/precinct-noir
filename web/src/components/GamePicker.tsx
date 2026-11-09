import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { modeName, modePlayers } from '../i18n/text'

/** Every game, in the order they're being built. The server says which ones can be played yet. */
const GAMES = [
  'killer_inspector',
  'spy_games',
  'hitman_sleuth',
  'master_thief',
  'fbi_mafia',
  'heist',
] as const

interface Props {
  /** The games the server offers; unknown while it hasn't answered. */
  readonly offered?: ReadonlySet<string>
  readonly value?: string
  readonly onChange: (mode: string) => void
  readonly disabled?: boolean
}

/**
 * The host's choice of game, typed up like an index on the folder's sheet. The games still being built
 * are listed too, marked "Coming later", so people can see what's on the way.
 */
export function GamePicker({ offered, value, onChange, disabled = false }: Props) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <fieldset className="game-pick" disabled={disabled}>
      <legend className="field__label">{t('home.host.game')}</legend>
      {GAMES.map((id) => {
        const later = offered !== undefined && !offered.has(id)
        const spoken = [modeName(t, id), later && t('home.host.later'), modePlayers(t, id)]
        return (
          <label key={id} className="game-pick__option" data-later={later || undefined}>
            <input
              type="radio"
              name={name}
              value={id}
              aria-label={spoken.filter(Boolean).join(', ')}
              checked={value === id}
              disabled={offered === undefined || later}
              onChange={() => onChange(id)}
            />
            <span className="game-pick__name">
              {modeName(t, id)}
              {later && <span className="game-pick__later">{t('home.host.later')}</span>}
            </span>
            <span className="game-pick__players">{modePlayers(t, id)}</span>
          </label>
        )
      })}
    </fieldset>
  )
}
