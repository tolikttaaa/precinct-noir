import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { MeView } from '../../protocol/generated'
import { SuspectCard } from '../SuspectCard'
import { suspectName } from '../suspects'

const HOLD_KEYS = new Set([' ', 'Enter'])

/**
 * The player's file, a slim folder above the board. Identity and evidence stay face down until the
 * player presses and holds it, and hide again on release, so a glance at the phone gives nothing away.
 * The folder keeps its size open or closed, so the board doesn't jump while it's held.
 */
export function Dossier({ me, onReveal }: { me: MeView; onReveal: (open: boolean) => void }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const set = (next: boolean) => {
    setOpen(next)
    onReveal(next)
  }
  const keyDown = (e: KeyboardEvent) => {
    if (HOLD_KEYS.has(e.key) && !e.repeat) {
      e.preventDefault()
      set(true)
    }
  }
  const keyUp = (e: KeyboardEvent) => {
    if (HOLD_KEYS.has(e.key)) set(false)
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
        onPointerDown={() => set(true)}
        onPointerUp={() => set(false)}
        onPointerLeave={() => set(false)}
        onPointerCancel={() => set(false)}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onBlur={() => set(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="dossier__tab" aria-hidden="true">
          {t('duel.file.title')}
        </span>
        {open ? (
          <span className="dossier__inside" aria-hidden="true">
            {me.identity === undefined ? (
              <span className="dossier__none">{t('duel.file.none')}</span>
            ) : (
              <span className="dossier__identity">
                <SuspectCard id={me.identity} mine />
              </span>
            )}
            {me.hand.length > 0 && (
              <span className="dossier__hand">
                {me.hand.map((id) => (
                  <SuspectCard key={id} id={id} />
                ))}
              </span>
            )}
          </span>
        ) : (
          <span className="dossier__closed" aria-hidden="true">
            <span className="dossier__role">{t(`duel.youAre.${me.role}`)}</span>
            <span className="dossier__hold">{t('duel.file.hold')}</span>
          </span>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {open ? spoken : ''}
      </p>
    </section>
  )
}
