/**
 * The city as a phone shows it, and the plans the test's players make on it. Pure, so the moves are easy to
 * follow: shifts rotate a line with wraparound, and "next to" means the eight neighbours, without wrapping.
 */
export type Axis = 'row' | 'col'

export interface Shift {
  readonly axis: Axis
  readonly index: number
  readonly by: 1 | -1
}

export interface Place {
  readonly r: number
  readonly c: number
  readonly alive: boolean
}

export interface Grid {
  readonly rows: number
  readonly cols: number
  readonly at: ReadonlyMap<number, Place>
}

/** Every one-step shift of every line. */
export function allShifts(grid: Grid): Shift[] {
  const shifts: Shift[] = []
  for (let index = 0; index < grid.rows; index++)
    shifts.push({ axis: 'row', index, by: 1 }, { axis: 'row', index, by: -1 })
  for (let index = 0; index < grid.cols; index++)
    shifts.push({ axis: 'col', index, by: 1 }, { axis: 'col', index, by: -1 })
  return shifts
}

/** The way the cards move, as the arrow on the board names it. */
export function direction(shift: Shift): 'left' | 'right' | 'up' | 'down' {
  if (shift.axis === 'row') return shift.by > 0 ? 'right' : 'left'
  return shift.by > 0 ? 'down' : 'up'
}

function place(grid: Grid, id: number): Place {
  const p = grid.at.get(id)
  if (!p) throw new Error(`Suspect ${id} isn't on the board`)
  return p
}

/** How many steps apart two suspects are, counting diagonals as one; 1 means next to each other. */
export function distance(grid: Grid, a: number, b: number): number {
  const pa = place(grid, a)
  const pb = place(grid, b)
  return Math.max(Math.abs(pa.r - pb.r), Math.abs(pa.c - pb.c))
}

export function shifted(grid: Grid, shift: Shift): Grid {
  const at = new Map<number, Place>()
  const mod = (n: number, m: number) => ((n % m) + m) % m
  for (const [id, p] of grid.at) {
    if (shift.axis === 'row' && p.r === shift.index)
      at.set(id, { ...p, c: mod(p.c + shift.by, grid.cols) })
    else if (shift.axis === 'col' && p.c === shift.index)
      at.set(id, { ...p, r: mod(p.r + shift.by, grid.rows) })
    else at.set(id, p)
  }
  return { ...grid, at }
}

/**
 * The shift, among [options], that brings [a] and [b] closest together, looking one more shift ahead to break
 * ties. One step alone can stall: when both share a column, sliding that column moves them both, so the first
 * shift has to split them sideways before the next one can close in.
 */
export function closingShift(grid: Grid, a: number, b: number, options: readonly Shift[]): Shift {
  let best: Shift | undefined
  let bestScore = [Infinity, Infinity]
  for (const option of options) {
    const next = shifted(grid, option)
    const now = distance(next, a, b)
    const later = Math.min(...allShifts(next).map((s) => distance(shifted(next, s), a, b)))
    if (now < bestScore[0] || (now === bestScore[0] && later < bestScore[1])) {
      best = option
      bestScore = [now, later]
    }
  }
  if (!best) throw new Error('No shift is possible')
  return best
}

/** A shift, among [options], that moves none of [keep]: a move that changes nothing that matters. */
export function quietShift(grid: Grid, keep: readonly number[], options: readonly Shift[]): Shift {
  const lines = keep.map((id) => place(grid, id))
  const quiet = options.find((o) =>
    lines.every((p) => (o.axis === 'row' ? p.r !== o.index : p.c !== o.index)),
  )
  if (!quiet) throw new Error('Every possible shift moves a suspect that should stay put')
  return quiet
}
