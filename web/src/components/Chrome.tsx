import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Connection } from '../net/roomSocket'
import { LanguageMenu } from './LanguageMenu'
import { SoundMenu } from './SoundMenu'
import { Link } from './Link'

/**
 * The strip at the top of every screen: the game's name (home link), the room code, the language and
 * the sound. Screens that play music ([music]: the board and the home screen) also get its slider.
 */
export function Masthead({
  code,
  named = true,
  music = false,
}: {
  code?: string
  named?: boolean
  music?: boolean
}) {
  const { t } = useTranslation()
  return (
    <header className="masthead">
      {named && (
        <Link to="/" className="wordmark">
          {t('appName')}
        </Link>
      )}
      {code && <span className="masthead__code">{code}</span>}
      <LanguageMenu />
      <SoundMenu music={music} />
    </header>
  )
}

/** Says when the room connection is not live. */
export function ConnectionNotice({ connection }: { connection: Connection }) {
  const { t } = useTranslation()
  return (
    <p className="connection" role="status" hidden={connection === 'open'}>
      {connection === 'open' ? '' : t(`connection.${connection}`)}
    </p>
  )
}

/** A short message that disappears after a few seconds. A new [id] shows it again. */
export function Flash({ message, id }: { message?: string; id: number }) {
  const [hiddenId, setHiddenId] = useState<number>()
  useEffect(() => {
    const timer = setTimeout(() => setHiddenId(id), 5000)
    return () => clearTimeout(timer)
  }, [id])
  const visible = message !== undefined && hiddenId !== id
  return (
    <p className="flash" role="status" hidden={!visible}>
      {visible ? message : ''}
    </p>
  )
}
