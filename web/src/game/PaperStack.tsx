import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { play } from '../sound/sound'
import { guideText, type GuidePageSpec } from './guides'
import './paper.css'

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

/** How long a page takes to turn; keep in step with `--turn-ms` in paper.css. */
const TURN_MS = 650
/** How far a finger must travel sideways before it counts as turning the page. */
const SWIPE_PX = 48
/** At most this many sheets show their edges under the top one. */
const EDGES = 3

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

interface PaperProps {
  readonly mode: string
  readonly spec: GuidePageSpec
  readonly n: number
  readonly total: number
  readonly className: string
  /** A copy drawn only for the turning animation; screen readers skip it. */
  readonly copy?: boolean
  /** An invisible copy that only takes up room, so every sheet is as tall as the longest page. */
  readonly sizer?: boolean
}

/** One typed sheet of the rules. */
function Paper({ mode, spec, n, total, className, copy, sizer }: PaperProps) {
  const { t } = useTranslation()
  return (
    <article
      className={className}
      aria-hidden={copy || sizer || undefined}
      data-pictured={spec.diagram ? true : undefined}
    >
      {/* A sizer keeps the number's line but not its words, so no page number shows up twice. */}
      <p className="paper__number">{sizer ? '\u00a0' : t('guide.page', { n, total })}</p>
      <h2 className="paper__title">{guideText(t, mode, spec.id, 'title')}</h2>
      {spec.diagram && <Diagram rows={spec.diagram} />}
      <p className="paper__body">{guideText(t, mode, spec.id, 'body')}</p>
    </article>
  )
}

interface Turn {
  readonly from: number
  readonly forward: boolean
  /** Whether to draw it: people who prefer less motion just see the next page. */
  readonly animated: boolean
  readonly id: number
}

function motionAllowed(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches === true
}

interface Props {
  readonly mode: string
  readonly pages: readonly GuidePageSpec[]
  /** The page on top, already within range. */
  readonly page: number
  /** Turns to another page by swipe or arrow keys; without it (the TV) the pages only follow [page]. */
  readonly onTurn?: (page: number) => void
  readonly describedBy?: string
}

/**
 * The rules as typed sheets fastened in a case file. A new [page] lifts the top sheet over the
 * fastener (or brings the previous one back down), with the sound of paper; the sheets left
 * underneath show their edges, so the stack thins as you read.
 */
export function PaperStack({ mode, pages, page, onTurn, describedBy }: Props) {
  const [shown, setShown] = useState(page)
  const [turn, setTurn] = useState<Turn>()
  const swipe = useRef<{ x: number; y: number }>(undefined)

  if (page !== shown) {
    setShown(page)
    setTurn({
      from: shown,
      forward: page > shown,
      animated: motionAllowed(),
      id: (turn?.id ?? 0) + 1,
    })
  }

  useEffect(() => play('folder'), [])

  useEffect(() => {
    if (!turn) return
    play(turn.forward ? 'pageTurn' : 'pageBack')
    if (!turn.animated) return
    // A newer turn clears this timer before it fires, so it only ever ends this one.
    const timer = setTimeout(() => setTurn(undefined), TURN_MS + 80)
    return () => clearTimeout(timer)
  }, [turn])

  const go = (next: number) => {
    if (onTurn && next >= 0 && next < pages.length) onTurn(next)
  }
  const keyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1)
  }
  const pointerDown = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  const pointerUp = (e: PointerEvent) => {
    const start = swipe.current
    swipe.current = undefined
    if (!start) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - start.y)) return
    go(dx < 0 ? page + 1 : page - 1)
  }

  const total = pages.length
  const drawn = turn?.animated ? turn : undefined
  const sheet = (n: number, className: string, copy?: boolean) => (
    <Paper
      key={copy ? `copy-${drawn?.id}` : `page-${n}`}
      mode={mode}
      spec={pages[n]}
      n={n + 1}
      total={total}
      className={className}
      copy={copy}
    />
  )
  const edges = Math.min(EDGES, total - page - 1)

  return (
    <div
      className="paper-stack"
      data-turning={drawn ? (drawn.forward ? 'forward' : 'back') : undefined}
      data-turnable={onTurn ? true : undefined}
      tabIndex={onTurn ? 0 : undefined}
      aria-describedby={describedBy}
      onKeyDown={onTurn ? keyDown : undefined}
      onPointerDown={onTurn ? pointerDown : undefined}
      onPointerUp={onTurn ? pointerUp : undefined}
      onPointerCancel={() => {
        swipe.current = undefined
      }}
    >
      {/* Real sheets are all one size: the file keeps still while the pages turn. */}
      {pages.map((spec, n) => (
        <Paper
          key={`size-${n}`}
          mode={mode}
          spec={spec}
          n={n + 1}
          total={total}
          className="paper paper--sizer"
          sizer
        />
      ))}
      {Array.from({ length: edges }, (_, i) => (
        <span key={`edge-${i}`} className="paper-stack__edge" data-depth={edges - i} />
      ))}
      {drawn && !drawn.forward && sheet(drawn.from, 'paper paper--under', true)}
      {sheet(
        page,
        drawn && !drawn.forward ? 'paper paper--current paper--returning' : 'paper paper--current',
      )}
      {drawn?.forward && sheet(drawn.from, 'paper paper--leaving', true)}
    </div>
  )
}
