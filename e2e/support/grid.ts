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

/** The living suspects next to [id]: the ones it could kill or accuse. */
export function neighbours(grid: Grid, id: number): number[] {
  return [...grid.at]
    .filter(([other, p]) => other !== id && p.alive && distance(grid, id, other) === 1)
    .map(([other]) => other)
}

function bodyLines(grid: Grid): { rows: Set<number>; cols: Set<number> } {
  const rows = new Set<number>()
  const cols = new Set<number>()
  for (const p of grid.at.values())
    if (!p.alive) {
      rows.add(p.r)
      cols.add(p.c)
    }
  return { rows, cols }
}

/** True when every row, or every column, has a body in it: then the city can close up. */
export function closes(grid: Grid): boolean {
  const { rows, cols } = bodyLines(grid)
  return rows.size === grid.rows || cols.size === grid.cols
}

/** How near the city is to closing up: the further-along way first, then both together. */
function nearness(grid: Grid): number {
  const { rows, cols } = bodyLines(grid)
  const r = rows.size / grid.rows
  const c = cols.size / grid.cols
  return Math.max(r, c) * 10 + r + c
}

function killed(grid: Grid, id: number): Grid {
  const at = new Map(grid.at)
  at.set(id, { ...place(grid, id), alive: false })
  return { ...grid, at }
}

export type Step = { readonly kill: number } | { readonly shift: Shift }

/**
 * The killer's next step towards closing the city up: a kill that puts a body in a row or column that had
 * none, or else a shift, among [options], after which such a kill is possible. It never kills [spare].
 * Undefined when neither would help.
 */
export function collapsePlan(
  grid: Grid,
  killer: number,
  spare: readonly number[],
  options: readonly Shift[],
): Step | undefined {
  const now = nearness(grid)
  const bestKill = (g: Grid) => {
    let best: { id: number; score: number } | undefined
    for (const id of neighbours(g, killer)) {
      if (spare.includes(id)) continue
      const score = nearness(killed(g, id))
      if (score > (best?.score ?? now)) best = { id, score }
    }
    return best
  }
  const kill = bestKill(grid)
  if (kill) return { kill: kill.id }
  let best: { shift: Shift; score: number } | undefined
  for (const shift of options) {
    const next = bestKill(shifted(grid, shift))
    if (next && next.score > (best?.score ?? -1)) best = { shift, score: next.score }
  }
  return best && { shift: best.shift }
}
