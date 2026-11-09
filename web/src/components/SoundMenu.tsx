import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import {
  levelOf,
  setLevel,
  setMuted,
  subscribeLevels,
  type Channel,
  type Level,
} from '../sound/levels'
import { startMusic } from '../sound/music'
import { play } from '../sound/sound'
import { closeOnFocusOut, useDismiss } from './useDismiss'
import './menus.css'

const audible = ({ level, muted }: Level) => !muted && level > 0

/**
 * How loud this device is: a speaker in the masthead that opens a slip with a slider for the effects
 * and, on the screens that play music ([music]: the board and the home screen), one for the music.
 * Each has its own mute. Being on such a screen is also what keeps the music playing.
 */
export function SoundMenu({ music = false }: { music?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const musicLevel = useSyncExternalStore(subscribeLevels, () => levelOf('music'))
  const effectsLevel = useSyncExternalStore(subscribeLevels, () => levelOf('effects'))
  const close = () => setOpen(false)
  useDismiss(open, area, button, close)

  useEffect(() => (music ? startMusic() : undefined), [music])
  useEffect(() => {
    if (open) panel.current?.querySelector('input')?.focus()
  }, [open])

  const silent = !audible(effectsLevel) && !(music && audible(musicLevel))
  return (
    <div className="menu menu--sound" ref={area} onBlur={closeOnFocusOut(close)}>
      <button
        ref={button}
        type="button"
        className="menu__button"
        aria-label={t('sound')}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="menu__solid" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
          <path
            d={
              silent
                ? 'm15.5 9.5 5 5m0-5-5 5'
                : 'M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11'
            }
          />
        </svg>
      </button>
      {open && (
        <div
          id={panelId}
          ref={panel}
          className="menu-card menu-card--sound"
          role="group"
          aria-label={t('sound')}
        >
          {music && <Volume channel="music" level={musicLevel} />}
          <Volume channel="effects" level={effectsLevel} />
        </div>
      )}
    </div>
  )
}

/** One channel: its mute, its name, a slider and the level it's at. */
function Volume({ channel, level }: { channel: Channel; level: Level }) {
  const { t } = useTranslation()
  const id = useId()
  const on = audible(level)
  const value = on ? `${level.level}` : t('volume.off')
  return (
    <div className="volume" data-off={on ? undefined : true}>
      <button
        type="button"
        className="volume__mute"
        aria-label={t(`volume.${channel}`)}
        aria-pressed={on}
        onClick={() => setMuted(channel, on)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {channel === 'music' ? (
            <>
              <path d="M9.5 17V6.5l10-2V15" />
              <circle className="menu__solid" cx="7" cy="17" r="2.5" />
              <circle className="menu__solid" cx="17" cy="15" r="2.5" />
            </>
          ) : (
            <>
              <path className="menu__solid" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
              <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />
            </>
          )}
          {!on && <path className="volume__slash" d="m4 4 16 16" />}
        </svg>
      </button>
      <label className="volume__name" htmlFor={id}>
        {t(`volume.${channel}`)}
      </label>
      <output className="volume__value" htmlFor={id}>
        {value}
      </output>
      <input
        id={id}
        className="volume__slider"
        type="range"
        min={0}
        max={100}
        step={5}
        value={level.level}
        aria-valuetext={on ? `${level.level}%` : t('volume.off')}
        style={{ '--fill': `${level.level}%` } as CSSProperties}
        onChange={(e) => {
          setLevel(channel, Number(e.target.value))
          // The effects answer with a key's click, so you hear the level you've picked.
          if (channel === 'effects') play('key')
        }}
      />
    </div>
  )
}
