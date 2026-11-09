import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { modeName, modePlayers, modeSummary } from '../i18n/text'

/** Every game, in the order they're being built. The server says which ones can be played yet. */
const GAMES: readonly string[] = [
  'killer_inspector',
  'spy_games',
  'hitman_sleuth',
  'master_thief',
  'fbi_mafia',
  'heist',
]

interface Props {
  /** The games the server offers; unknown while it hasn't answered. */
  readonly offered?: ReadonlySet<string>
  readonly value?: string
  readonly onChange: (mode: string) => void
  readonly disabled?: boolean
}

/**
 * The host's choice of game: a field inked on the folder's sheet. It pulls a top-secret page out of the
 * folder with every game on it and what each one is about. The ones still being built are on it too,
 * stamped "Coming later", and can't be chosen.
 */
export function GamePicker({ offered, value, onChange, disabled = false }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const field = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  // Until the server has listed its games, the room would open in the first one.
  const shown = value ?? GAMES[0]
  const close = () => {
    setOpen(false)
    field.current!.focus()
  }
  return (
    <div className="field game-pick">
      <span className="field__label" id={`${id}-label`}>
        {t('home.host.game')}
      </span>
      <button
        ref={field}
        type="button"
        className="game-pick__field"
        aria-haspopup="dialog"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-describedby={`${id}-about`}
        disabled={disabled || offered === undefined}
        onClick={() => setOpen(true)}
      >
        <span id={`${id}-value`} className="game-pick__value">
          {modeName(t, shown)}
        </span>
        <span className="game-pick__players">{modePlayers(t, shown)}</span>
        <span className="game-pick__browse">{t('home.cases.browse')}</span>
      </button>
      <span id={`${id}-about`} className="hint">
        {modeSummary(t, shown)}
      </span>
      {open &&
        createPortal(
          <SecretPage
            offered={offered!}
            chosen={shown}
            onChoose={(game) => {
              onChange(game)
              close()
            }}
            onClose={close}
          />,
          document.body,
        )}
    </div>
  )
}

interface PageProps {
  readonly offered: ReadonlySet<string>
  readonly chosen: string
  readonly onChoose: (game: string) => void
  readonly onClose: () => void
}

/**
 * The page pulled out of the folder: a typed sheet stamped "Top secret", one entry per game. A dialog: the
 * focus starts on the page and stays inside it, Escape or a press beside it puts it back.
 */
function SecretPage({ offered, chosen, onChoose, onClose }: PageProps) {
  const { t } = useTranslation()
  const id = useId()
  const page = useRef<HTMLElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  // Taller than the screen, so it scrolls: then it gets a second Close at its end.
  const [long, setLong] = useState(false)

  useLayoutEffect(() => {
    const measure = () => setLong(sheet.current!.scrollHeight > sheet.current!.clientHeight)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    // The page opens at its top; focusing it mustn't scroll it into the middle.
    page.current!.focus({ preventScroll: true })
    const scroll = document.body.style.overflow
    document.body.style.overflow = 'hidden' // the page scrolls, not the screen behind it
    return () => {
      document.body.style.overflow = scroll
    }
  }, [])

  const keyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    // Keep the focus on the page: from the last control back to the first, and the other way.
    const controls = [...page.current!.querySelectorAll<HTMLElement>('button')]
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === page.current)
    ) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={sheet}
      className="secret"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        ref={page}
        className="secret__page"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        onKeyDown={keyDown}
      >
        <header className="secret__head">
          <h2 id={`${id}-title`} className="secret__title">
            {t('home.cases.title')}
          </h2>
          <span className="stamp secret__stamp" aria-hidden="true">
            {t('home.cases.secret')}
          </span>
          <button type="button" className="secret__close" onClick={onClose}>
            {t('home.cases.close')}
          </button>
        </header>
        <ul className="secret__cases">
          {GAMES.map((game) => {
            const name = modeName(t, game)
            const later = !offered.has(game)
            return (
              <li key={game} className="secret__case" data-later={later || undefined}>
                <h3 className="secret__name">{name}</h3>
                <span className="secret__players">{modePlayers(t, game)}</span>
                <p className="secret__summary">{modeSummary(t, game)}</p>
                <div className="secret__action">
                  {later ? (
                    <span className="stamp secret__later">{t('home.host.later')}</span>
                  ) : game === chosen ? (
                    <span className="stamp secret__chosen">{t('home.cases.chosen')}</span>
                  ) : (
                    <button
                      type="button"
                      className="button"
                      aria-label={t('home.cases.chooseNamed', { name })}
                      onClick={() => onChoose(game)}
                    >
                      {t('home.cases.choose')}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        {long && (
          <button type="button" className="secret__close secret__close--end" onClick={onClose}>
            {t('home.cases.close')}
          </button>
        )}
      </section>
    </div>
  )
}
