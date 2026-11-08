import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { play, setSoundOn, soundOn, subscribeSound } from '../sound/sound'
import './sound-switch.css'

/** Sound on or off for this device, next to the languages. */
export function SoundSwitch() {
  const { t } = useTranslation()
  const on = useSyncExternalStore(subscribeSound, soundOn)
  return (
    <button
      type="button"
      className="sound-switch"
      aria-label={t('sound')}
      title={t('sound')}
      aria-pressed={on}
      onClick={() => {
        setSoundOn(!on)
        if (!on) play('key')
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="sound-switch__speaker" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {on ? (
          <path
            className="sound-switch__waves"
            d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"
          />
        ) : (
          <path className="sound-switch__waves" d="m15.5 9.5 5 5m0-5-5 5" />
        )}
      </svg>
    </button>
  )
}
