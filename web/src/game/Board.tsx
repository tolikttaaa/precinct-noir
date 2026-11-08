import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Line, ShiftRecord, TileView } from '../protocol/generated'
import { direction, glide } from './motion'
import { SuspectCard } from './SuspectCard'

export interface ShiftControls {
  readonly can: (line: Line, by: number) => boolean
  readonly onShift: (line: Line, by: number) => void
  readonly chosen?: { readonly line: Line; readonly by: number }
}

interface Props {
  readonly rows: number
  readonly cols: number
  /** Row-major, as the server sends them. */
  readonly tiles: readonly TileView[]
  readonly size: 'tv' | 'phone'
  readonly lit?: ReadonlySet<number>
  readonly chosen?: ReadonlySet<number>
  readonly mine?: number
  /** The viewer's evidence cards, marked where they stand (the open file). */
  readonly evidence?: ReadonlySet<number>
  /** Called for lit tiles only. */
  readonly onTile?: (id: number) => void
  /** Arrows on every edge, to slide a row or column. */
  readonly shift?: ShiftControls
  /** Marks the line that moved last (TV). */
  readonly lastShift?: ShiftRecord
  /** Row and column numbers on the edges (TV), so the case log's "row 3" can be found. */
  readonly labels?: boolean
}

const GLIDE_MS = 420

/**
 * The city: a grid of suspect cards. Cards keep their identity across updates, so a shift or a
 * collapse glides each card from where it was (a card that wrapped around slides in from the edge).
 */
export function Board(props: Props) {
  const { rows, cols, tiles, size, lit, chosen, mine, evidence, onTile, shift, lastShift, labels } =
    props
  const { t } = useTranslation()
  const nodes = useRef(new Map<number, HTMLElement>())
  const rects = useRef(new Map<number, DOMRect>())
  const layout = `${rows}x${cols}:${tiles.map((tile) => tile.id).join(',')}`

  useLayoutEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const next = new Map<number, DOMRect>()
    nodes.current.forEach((node, id) => {
      const rect = node.getBoundingClientRect()
      next.set(id, rect)
      const old = rects.current.get(id)
      if (!old || still || typeof node.animate !== 'function') return
      const dx = old.left - rect.left
      const dy = old.top - rect.top
      if (dx === 0 && dy === 0) return
      node.animate(glide(dx, dy, rect.width, rect.height), {
        duration: GLIDE_MS,
        easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      })
    })
    rects.current = next
  }, [layout])

  const edges = Boolean(shift || labels)
  const offset = edges ? 2 : 1
  const cells: ReactNode[] = tiles.map((tile, i) => (
    <div
      key={tile.id}
      className="board__cell"
      ref={(node) => {
        // With a cleanup function returned, React never calls this with null.
        nodes.current.set(tile.id, node as HTMLDivElement)
        return () => {
          nodes.current.delete(tile.id)
        }
      }}
      style={{ gridRow: Math.floor(i / cols) + offset, gridColumn: (i % cols) + offset }}
    >
      <SuspectCard
        id={tile.id}
        dead={!tile.alive}
        cleared={tile.exonerated}
        lit={lit?.has(tile.id)}
        chosen={chosen?.has(tile.id)}
        mine={mine === tile.id}
        evidence={evidence?.has(tile.id)}
        onPick={onTile && lit?.has(tile.id) ? () => onTile(tile.id) : undefined}
      />
    </div>
  ))

  if (labels) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <span
          key={`col${c}`}
          className="board__label"
          data-last={isLast(lastShift, 'col', c) || undefined}
          style={{ gridRow: 1, gridColumn: c + 2 }}
        >
          {c + 1}
        </span>,
      )
    }
    for (let r = 0; r < rows; r++) {
      cells.push(
        <span
          key={`row${r}`}
          className="board__label"
          data-last={isLast(lastShift, 'row', r) || undefined}
          style={{ gridRow: r + 2, gridColumn: 1 }}
        >
          {r + 1}
        </span>,
      )
    }
  }

  if (shift) {
    const arrow = (line: Line, by: number, gridRow: number, gridColumn: number) => {
      const way = direction(line, by)
      const picked =
        shift.chosen?.line.axis === line.axis &&
        shift.chosen.line.index === line.index &&
        shift.chosen.by === by
      return (
        <button
          key={`${line.axis}${line.index}${way}`}
          type="button"
          className={`board__arrow board__arrow--${way}`}
          aria-label={t(`duel.shiftLine.${line.axis}`, {
            n: line.index + 1,
            dir: t(`duel.dir.${way}`),
          })}
          aria-pressed={picked}
          disabled={!shift.can(line, by)}
          onClick={() => shift.onShift(line, by)}
          style={{ gridRow, gridColumn }}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 4.5 6 7.5 9 4.5" />
          </svg>
        </button>
      )
    }
    for (let c = 0; c < cols; c++) {
      const line: Line = { axis: 'col', index: c }
      cells.push(arrow(line, -1, 1, c + 2), arrow(line, 1, rows + 2, c + 2))
    }
    for (let r = 0; r < rows; r++) {
      const line: Line = { axis: 'row', index: r }
      cells.push(arrow(line, -1, r + 2, 1), arrow(line, 1, r + 2, cols + 2))
    }
  }

  return (
    <div
      className={`board board--${size}`}
      role="group"
      aria-label={t('duel.board')}
      data-edges={edges ? (shift ? 'arrows' : 'labels') : undefined}
      style={
        {
          gridTemplateColumns: track(cols, edges, Boolean(shift)),
          gridTemplateRows: track(rows, edges, Boolean(shift)),
          // For layouts that fit the board to a height (the open file).
          '--rows': rows,
          '--cols': cols,
        } as CSSProperties
      }
    >
      {cells}
    </div>
  )
}

function track(count: number, edges: boolean, trailing: boolean): string {
  const middle = `repeat(${count}, minmax(0, 1fr))`
  if (!edges) return middle
  return trailing ? `auto ${middle} auto` : `auto ${middle}`
}

function isLast(last: ShiftRecord | undefined, axis: Line['axis'], index: number): boolean {
  return last?.line.axis === axis && last.line.index === index
}
