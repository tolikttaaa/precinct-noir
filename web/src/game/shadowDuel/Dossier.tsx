import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { MeView } from '../../protocol/generated'
import { SuspectCard } from '../SuspectCard'
import { suspectName } from '../suspects'

const HOLD_KEYS = new Set([' ', 'Enter'])

interface Props {
  readonly me: MeView
  /** The city with the player's own tile marked, shown inside the open file. */
  readonly city?: ReactNode
}

/**
 * The player's file: a slim strip above the board, face down. While the player presses and holds it,
 * it opens over the whole screen with their identity, their evidence and where they stand in the city,
 * and it closes on release, so a glance at the phone gives nothing away. The open file is part of the
 * strip, so the finger that holds it never leaves it.
 */
export function Dossier({ me, city }: Props) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const keyDown = (e: KeyboardEvent) => {
    if (HOLD_KEYS.has(e.key) && !e.repeat) {
      e.preventDefault()
      setOpen(true)
    }
  }
  const keyUp = (e: KeyboardEvent) => {
    if (HOLD_KEYS.has(e.key)) setOpen(false)
  }
  const name = (id: number) => suspectName(id, i18n.language)
  const spoken =
    me.identity === undefined
      ? t('duel.file.none')
      : [
          t('duel.log.yourIdentity', { name: name(me.identity) }),
          me.hand.length > 0 && `${t('duel.file.hand')}: ${me.hand.map(name).join(', ')}.`,
        ]
          .filter(Boolean)
          .join(' ')
  return (
    <section className="dossier" data-open={open || undefined}>
      <div
        role="button"
        tabIndex={0}
        className="dossier__folder"
        aria-pressed={open}
        aria-label={`${t('duel.file.title')}: ${t('duel.file.hold')}`}
        onPointerDown={() => setOpen(true)}
        onPointerUp={() => setOpen(false)}
        onPointerLeave={() => setOpen(false)}
        onPointerCancel={() => setOpen(false)}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onBlur={() => setOpen(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="dossier__tab" aria-hidden="true">
          {t('duel.file.title')}
        </span>
        <span className="dossier__closed" aria-hidden="true">
          <span className="dossier__role">{t(`duel.youAre.${me.role}`)}</span>
          <span className="dossier__hold">{t('duel.file.hold')}</span>
        </span>
        {open && (
          <div className="dossier__open" aria-hidden="true">
            <span className="dossier__title">{t('duel.file.title')}</span>
            <div className="dossier__people">
              <div className="dossier__group">
                <span className="dossier__label dossier__label--you">
                  {t('duel.file.identity')}
                </span>
                {me.identity === undefined ? (
                  <span className="dossier__none">{t('duel.file.none')}</span>
                ) : (
                  <span className="dossier__identity">
                    <SuspectCard id={me.identity} mine />
                  </span>
                )}
              </div>
              {me.hand.length > 0 && (
                <div className="dossier__group">
                  <span className="dossier__label dossier__label--evidence">
                    {t('duel.file.hand')}
                  </span>
                  <span
                    className="dossier__hand"
                    style={{ '--per-row': Math.min(me.hand.length, 4) } as CSSProperties}
                  >
                    {me.hand.map((id) => (
                      <SuspectCard key={id} id={id} />
                    ))}
                  </span>
                </div>
              )}
            </div>
            {city && <div className="dossier__city">{city}</div>}
            <span className="dossier__hint">{t('duel.file.hint')}</span>
          </div>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {open ? spoken : ''}
      </p>
    </section>
  )
}
