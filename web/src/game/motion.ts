import type { Line } from '../protocol/generated'

export type Direction = 'left' | 'right' | 'up' | 'down'

/** Which way a shift moves its line: positive moves right along a row and down a column. */
export function direction(line: Line, by: number): Direction {
  if (line.axis === 'row') return by > 0 ? 'right' : 'left'
  return by > 0 ? 'down' : 'up'
}

/**
 * Keyframes that glide a card from its old place (dx, dy away) to its new one. A card that jumped
 * more than a cell and a half wrapped around the edge, so it slides in by one cell from that side.
 */
export function glide(dx: number, dy: number, width: number, height: number): Keyframe[] {
  const wrapX = Math.abs(dx) > width * 1.5
  const wrapY = Math.abs(dy) > height * 1.5
  if (!wrapX && !wrapY) {
    return [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }]
  }
  const fromX = wrapX ? -Math.sign(dx) * width : dx
  const fromY = wrapY ? -Math.sign(dy) * height : dy
  return [
    { transform: `translate(${fromX}px, ${fromY}px)`, opacity: 0 },
    { transform: 'none', opacity: 1 },
  ]
}
