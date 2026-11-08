import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { modeName } from '../i18n/text'
import { GUIDES, guideText, type GuidePageSpec } from './guides'

const CELLS: Readonly<Record<string, string>> = {
  '.': 'plain',
  n: 'near',
  Y: 'you',
  K: 'killer',
  I: 'inspector',
  x: 'body',
  c: 'cleared',
  '>': 'moving',
}

function Diagram({ rows }: { rows: readonly string[] }) {
  const { t } = useTranslation()
  const marks: Readonly<Record<string, string>> = {
    Y: t('guide.you'),
    K: t('duel.role.killer').charAt(0),
    I: t('duel.role.inspector').charAt(0),
    '>': '→',
  }
  return (
    <div
      className="diagram"
      aria-hidden="true"
      style={{ gridTemplateColumns: `repeat(${rows[0].length}, 1fr)` }}
    >
      {rows.flatMap((row, r) =>
        [...row].map((cell, c) => (
          <span key={`${r}-${c}`} className="diagram__cell" data-cell={CELLS[cell]}>
            {marks[cell] ?? ''}
          </span>
        )),
      )}
    </div>
  )
}

function GuidePage({
  mode,
  spec,
  n,
  total,
}: {
  mode: string
  spec: GuidePageSpec
  n: number
  total: number
}) {
  const { t } = useTranslation()
  return (
    <article className="guide__page">
      <h2 className="guide__title">{guideText(t, mode, spec.id, 'title')}</h2>
      {spec.diagram && <Diagram rows={spec.diagram} />}
      <p className="guide__body">{guideText(t, mode, spec.id, 'body')}</p>
      <p className="hint guide__count">{t('guide.page', { n, total })}</p>
    </article>
  )
}

interface SheetProps {
  readonly mode: string
  readonly onClose: () => void
  readonly closeLabel?: string
  /** The VIP in the lobby can put the current page on the board for everyone. */
  readonly board?: { readonly showing: boolean; readonly show: (page: number | null) => void }
}

/** The walkthrough on a phone, page by page. */
export function GuideSheet({ mode, onClose, closeLabel, board }: SheetProps) {
  const { t } = useTranslation()
  const pages = GUIDES[mode] ?? []
  const [page, setPage] = useState(0)
  const titleId = useId()
  const go = (next: number) => {
    setPage(next)
    if (board?.showing) board.show(next)
  }
  if (pages.length === 0) return null
  return (
    <section className="guide" aria-labelledby={titleId}>
      <h1 id={titleId} className="section-title">
        {t('guide.title', { mode: modeName(t, mode) })}
      </h1>
      <GuidePage mode={mode} spec={pages[page]} n={page + 1} total={pages.length} />
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
    </section>
  )
}

/** The walkthrough on the TV, on the page the VIP chose. */
export function GuideBoard({ mode, page, code }: { mode: string; page: number; code: string }) {
  const { t } = useTranslation()
  const pages = GUIDES[mode] ?? []
  if (pages.length === 0) return null
  const n = Math.min(Math.max(page, 0), pages.length - 1)
  return (
    <section className="folder guide guide--tv" aria-labelledby="guide-tv-title">
      <h1 className="folder__tab" id="guide-tv-title">
        <span className="folder__label">{t('guide.title', { mode: modeName(t, mode) })}</span>
      </h1>
      <div className="folder__front">
        <GuidePage mode={mode} spec={pages[n]} n={n + 1} total={pages.length} />
        <p className="guide__code">{t('guide.roomCode', { code })}</p>
      </div>
    </section>
  )
}
