import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { modeName } from '../i18n/text'
import { GUIDES } from './guides'
import { PaperStack } from './PaperStack'

/** An open case file with a tab naming the game, holding the rules. */
function GuideFile({
  mode,
  tv,
  children,
  after,
}: {
  mode: string
  tv?: boolean
  children: ReactNode
  after?: ReactNode
}) {
  const { t } = useTranslation()
  const titleId = useId()
  return (
    <section className={tv ? 'guide guide--tv' : 'guide'} aria-labelledby={titleId}>
      <h1 id={titleId} className="guide__tab">
        <span className="folder__label">{t('guide.title', { mode: modeName(t, mode) })}</span>
      </h1>
      <div className="guide__file">{children}</div>
      {after}
    </section>
  )
}

interface SheetProps {
  readonly mode: string
  readonly onClose: () => void
  readonly closeLabel?: string
  /** The VIP in the lobby can put the current page on the board for everyone. */
  readonly board?: { readonly showing: boolean; readonly show: (page: number | null) => void }
}

/**
 * The rules on a phone: turn the pages by swiping, with the arrow keys or with the buttons, which keep to
 * the bar at the bottom of the screen. While it's open it takes the place of the screen's own bar.
 */
export function GuideSheet({ mode, onClose, closeLabel, board }: SheetProps) {
  const { t } = useTranslation()
  const pages = GUIDES[mode] ?? []
  const [page, setPage] = useState(0)
  const hintId = useId()
  const go = (next: number) => {
    setPage(next)
    if (board?.showing) board.show(next)
  }
  if (pages.length === 0) return null
  return (
    <GuideFile
      mode={mode}
      after={
        <>
          <p id={hintId} className="hint">
            {t('guide.swipe')}
          </p>
          {/* Turning the pages is the thumb's job: the buttons stay at the bottom of the screen. */}
          <footer className="action-bar guide__bar">
            <div className="guide__nav">
              <button
                type="button"
                className="button button--quiet"
                disabled={page === 0}
                onClick={() => go(page - 1)}
              >
                {t('guide.back')}
              </button>
              <button
                type="button"
                className="button"
                disabled={page === pages.length - 1}
                onClick={() => go(page + 1)}
              >
                {t('guide.next')}
              </button>
            </div>
            <div className="guide__more">
              {board && (
                <button
                  type="button"
                  className="button button--quiet"
                  aria-pressed={board.showing}
                  onClick={() => board.show(board.showing ? null : page)}
                >
                  {board.showing ? t('guide.hideFromBoard') : t('guide.showOnBoard')}
                </button>
              )}
              <button
                type="button"
                className="button button--quiet"
                onClick={() => {
                  if (board?.showing) board.show(null)
                  onClose()
                }}
              >
                {closeLabel ?? t('guide.close')}
              </button>
            </div>
          </footer>
        </>
      }
    >
      <PaperStack mode={mode} pages={pages} page={page} onTurn={go} describedBy={hintId} />
    </GuideFile>
  )
}

/** The rules on the TV, open at the page the VIP turned to. */
export function GuideBoard({ mode, page, code }: { mode: string; page: number; code: string }) {
  const { t } = useTranslation()
  const pages = GUIDES[mode] ?? []
  if (pages.length === 0) return null
  const n = Math.min(Math.max(page, 0), pages.length - 1)
  return (
    <GuideFile mode={mode} tv>
      <PaperStack mode={mode} pages={pages} page={n} />
      <p className="guide__code">{t('guide.roomCode', { code })}</p>
    </GuideFile>
  )
}
