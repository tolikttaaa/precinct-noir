import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage, type Language } from '../i18n'
import { closeOnFocusOut, useDismiss } from './useDismiss'
import './menus.css'

/** The page's language: a short code in the masthead that opens a slip listing each language by its own name. */
export function LanguageMenu() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const current: Language = LANGUAGES.find((language) => language === i18n.language) ?? 'en'
  const close = () => setOpen(false)
  useDismiss(open, area, button, close)

  // Opening the menu puts the focus on the language in use, as menus do.
  useEffect(() => {
    if (open) items.current[LANGUAGES.indexOf(current)]?.focus()
  }, [open, current])

  const choose = (language: Language) => {
    setLanguage(language)
    close()
    button.current?.focus()
  }
  const move = (e: KeyboardEvent<HTMLUListElement>) => {
    const at = items.current.indexOf(document.activeElement as HTMLButtonElement)
    const last = LANGUAGES.length - 1
    const to: Readonly<Record<string, number>> = {
      ArrowDown: at === last ? 0 : at + 1,
      ArrowUp: at <= 0 ? last : at - 1,
      Home: 0,
      End: last,
    }
    if (!(e.key in to)) return
    e.preventDefault()
    items.current[to[e.key]]?.focus()
  }

  return (
    <div className="menu menu--language" ref={area} onBlur={closeOnFocusOut(close)}>
      <button
        ref={button}
        type="button"
        className="menu__button"
        aria-label={t('languageNow', { name: t(`languages.${current}`) })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
      >
        <span lang={current}>{current.toUpperCase()}</span>
        <svg className="menu__caret" viewBox="0 0 10 10" aria-hidden="true">
          <path d="m2 3.5 3 3 3-3" />
        </svg>
      </button>
      {open && (
        <ul
          id={menuId}
          className="menu-card menu-card--list"
          role="menu"
          aria-label={t('language')}
          onKeyDown={move}
        >
          {LANGUAGES.map((language, i) => (
            <li key={language} role="none">
              <button
                ref={(el) => {
                  items.current[i] = el
                }}
                type="button"
                role="menuitemradio"
                aria-checked={language === current}
                lang={language}
                tabIndex={-1}
                onClick={() => choose(language)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3 8.5 3.2 3L13 4.5" />
                </svg>
                {t(`languages.${language}`)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
