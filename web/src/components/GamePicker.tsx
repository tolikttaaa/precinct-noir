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

/** A guess at the card's height, until it has been drawn once and measured. */
const CARD_GUESS = 300
const GAP = 6
const EDGE = 12

/**
 * Where the open card goes: under the field if it fits there whole, else over the field if it fits there,
 * else on the side with more room (and it scrolls).
 */
interface Placement {
  readonly left: number
  readonly width: number
  readonly top?: number
  readonly bottom?: number
  readonly maxHeight: number
}

function place(field: HTMLElement, height: number): Placement {
  const r = field.getBoundingClientRect()
  const below = window.innerHeight - r.bottom - GAP - EDGE
  const above = r.top - GAP - EDGE
  const across = { left: r.left, width: r.width }
  return below >= height || (above < height && below >= above)
    ? { ...across, top: r.bottom + GAP, maxHeight: below }
    : { ...across, bottom: window.innerHeight - r.top + GAP, maxHeight: above }
}

interface Props {
  /** The games the server offers; unknown while it hasn't answered. */
  readonly offered?: ReadonlySet<string>
  readonly value?: string
  readonly onChange: (mode: string) => void
  readonly disabled?: boolean
}

/**
 * The host's choice of game: a field inked on the folder's sheet that drops an index card with every game
 * on it. The games still being built are on the card too, stamped "Coming later", and can't be picked.
 * It works like a select from the keyboard (arrows, Home, End, Enter, Space, Escape, Tab) and for screen
 * readers (the ARIA select-only combobox). The card floats above the page, because the folder's front
 * panel clips whatever leaves it.
 */
export function GamePicker({ offered, value, onChange, disabled = false }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const field = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLUListElement>(null)
  const height = useRef(CARD_GUESS)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [active, setActive] = useState(0)
  const open = placement !== null
  // Until the server has listed its games, the room would open in the first one.
  const shown = value ?? GAMES[0]
  const off = disabled || offered === undefined
  const playable = (index: number) => offered!.has(GAMES[index])

  const show = (index = Math.max(0, GAMES.indexOf(shown))) => {
    setPlacement(place(field.current!, height.current))
    setActive(index)
  }
  const close = () => setPlacement(null)
  const choose = (index: number) => {
    if (!playable(index)) return
    onChange(GAMES[index])
    close()
  }
  /** The next playable game from [from], going [by]; [from] itself when there's none. */
  const next = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < GAMES.length; i += by) if (playable(i)) return i
    return from
  }
  const first = () => next(-1, 1)
  const last = () => next(GAMES.length, -1)

  const keyDown = (e: KeyboardEvent) => {
    if (off) return
    if (!open) {
      const at = {
        ArrowDown: undefined,
        ArrowUp: undefined,
        Enter: undefined,
        ' ': undefined,
        Home: first,
        End: last,
      }
      if (!(e.key in at)) return
      e.preventDefault()
      show(at[e.key as keyof typeof at]?.())
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        setActive((i) => next(i, 1))
        break
      case 'ArrowUp':
        setActive((i) => next(i, -1))
        break
      case 'Home':
        setActive(first())
        break
      case 'End':
        setActive(last())
        break
      case 'Enter':
      case ' ':
        choose(active)
        break
      case 'Escape':
        close()
        break
      case 'Tab':
        choose(active)
        close()
        return // and let the focus move on
      default:
        return
    }
    e.preventDefault()
  }

  // Once the card is drawn, place it again by its real height, before it's shown.
  useLayoutEffect(() => {
    if (!open) return
    height.current = card.current!.scrollHeight
    setPlacement(place(field.current!, height.current))
  }, [open])

  useEffect(() => {
    if (!open) return
    const follow = () => setPlacement(place(field.current!, height.current))
    const outside = (e: PointerEvent) => {
      const target = e.target as Node
      if (!field.current!.contains(target) && !card.current!.contains(target)) setPlacement(null)
    }
    window.addEventListener('resize', follow)
    window.addEventListener('scroll', follow, true)
    document.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('resize', follow)
      window.removeEventListener('scroll', follow, true)
      document.removeEventListener('pointerdown', outside)
    }
  }, [open])

  useEffect(() => {
    if (open) card.current!.children[active].scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const spoken = (game: string, later: boolean) =>
    [modeName(t, game), later && t('home.host.later'), modePlayers(t, game)]
      .filter(Boolean)
      .join(', ')

  return (
    <div className="field game-pick">
      <span className="field__label" id={`${id}-label`}>
        {t('home.host.game')}
      </span>
      <div
        ref={field}
        role="combobox"
        tabIndex={0}
        className="game-pick__field"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-about`}
        aria-haspopup="listbox"
        aria-controls={`${id}-card`}
        aria-expanded={open}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-disabled={off || undefined}
        onClick={() => {
          if (off) return
          if (open) close()
          else show()
        }}
        onKeyDown={keyDown}
        onBlur={close}
      >
        <span className="game-pick__value">{modeName(t, shown)}</span>
        <span className="game-pick__players">{modePlayers(t, shown)}</span>
      </div>
      <span id={`${id}-about`} className="hint">
        {modeSummary(t, shown) || modePlayers(t, shown)}
      </span>
      {open &&
        createPortal(
          <ul
            ref={card}
            id={`${id}-card`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="game-menu"
            style={placement}
          >
            {GAMES.map((game, i) => {
              const later = !playable(i)
              return (
                <li
                  key={game}
                  id={`${id}-${i}`}
                  role="option"
                  aria-label={spoken(game, later)}
                  aria-selected={game === shown}
                  aria-disabled={later || undefined}
                  className="game-menu__option"
                  data-active={i === active || undefined}
                  // Keep the focus on the field, so it doesn't close before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => {
                    if (!later) setActive(i)
                  }}
                  onClick={() => choose(i)}
                >
                  <span className="game-menu__tick" aria-hidden="true" />
                  <span className="game-menu__name">
                    {modeName(t, game)}
                    {later && (
                      <span className="stamp game-menu__stamp">{t('home.host.later')}</span>
                    )}
                  </span>
                  <span className="game-menu__players">{modePlayers(t, game)}</span>
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </div>
  )
}
