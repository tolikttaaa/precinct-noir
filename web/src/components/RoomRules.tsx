import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { modeName, optionText } from '../i18n/text'
import type { Command } from '../net/roomSocket'
import type { ModeInfo, RoomView } from '../protocol/generated'

const TIMERS = [null, 60, 90, 120] as const

interface Props {
  readonly room: RoomView
  readonly modes: readonly ModeInfo[]
  /** Only the VIP edits, and only in the lobby. */
  readonly editable: boolean
  readonly send: (command: Command) => void
}

/** The game, its house rules and the turn timer. Everyone sees them; the VIP changes them. */
export function RoomRules({ room, modes, editable, send }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const mode = modes.find((m) => m.id === room.mode)
  const value = (key: string, fallback: boolean | number) =>
    (room.config[key] ?? fallback) as typeof fallback
  return (
    <section className="rules" aria-labelledby="rules-title">
      <h2 id="rules-title" className="section-title">
        {t('lobby.rules')}
      </h2>
      <label className="field">
        <span className="field__label">{t('lobby.game')}</span>
        <select
          value={room.mode}
          disabled={!editable}
          onChange={(e) => send({ t: 'set_mode', mode: e.target.value })}
        >
          {modes.map((m) => (
            <option key={m.id} value={m.id}>
              {modeName(t, m.id)}
            </option>
          ))}
        </select>
      </label>
      {mode?.config.options.map((option) =>
        option.t === 'toggle' ? (
          <div key={option.key} className="field field--toggle">
            <input
              id={`${id}-${option.key}`}
              type="checkbox"
              role="switch"
              aria-describedby={`${id}-${option.key}-hint`}
              checked={value(option.key, option.default) as boolean}
              disabled={!editable}
              onChange={(e) =>
                send({
                  t: 'set_config',
                  config: { ...room.config, [option.key]: e.target.checked },
                })
              }
            />
            <label className="field__label" htmlFor={`${id}-${option.key}`}>
              {optionText(t, room.mode, option.key, 'label')}
            </label>
            <span id={`${id}-${option.key}-hint`} className="hint">
              {optionText(t, room.mode, option.key, 'hint')}
            </span>
          </div>
        ) : (
          <div key={option.key} className="field">
            <label className="field__label" htmlFor={`${id}-${option.key}`}>
              {optionText(t, room.mode, option.key, 'label')}
            </label>
            <select
              id={`${id}-${option.key}`}
              aria-describedby={`${id}-${option.key}-hint`}
              value={value(option.key, option.default) as number}
              disabled={!editable}
              onChange={(e) =>
                send({
                  t: 'set_config',
                  config: { ...room.config, [option.key]: Number(e.target.value) },
                })
              }
            >
              {Array.from({ length: option.max - option.min + 1 }, (_, i) => option.min + i).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ),
              )}
            </select>
            <span id={`${id}-${option.key}-hint`} className="hint">
              {optionText(t, room.mode, option.key, 'hint')}
            </span>
          </div>
        ),
      )}
      <fieldset className="field" disabled={!editable} aria-describedby={`${id}-timer-hint`}>
        <legend className="field__label">{t('lobby.timer')}</legend>
        <div className="segmented">
          {TIMERS.map((seconds) => (
            <label key={seconds ?? 'off'} className="segmented__option">
              <input
                type="radio"
                name="turn-timer"
                checked={(room.turnTimer ?? null) === seconds}
                onChange={() =>
                  send(seconds === null ? { t: 'set_timer' } : { t: 'set_timer', seconds })
                }
              />
              <span>
                {seconds === null
                  ? t('lobby.timerOff')
                  : t('lobby.timerSeconds', { count: seconds })}
              </span>
            </label>
          ))}
        </div>
        <span id={`${id}-timer-hint`} className="hint">
          {t('lobby.timerHint')}
        </span>
      </fieldset>
    </section>
  )
}
