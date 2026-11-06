import type { MemberView } from '../protocol/generated'

/** Who plays: during a game the server's seats; in the lobby the first players to join, up to [max]. */
export function playingIds(
  members: readonly MemberView[],
  seats: readonly number[],
  max: number,
): ReadonlySet<number> {
  return new Set(seats.length > 0 ? seats : members.slice(0, max).map((m) => m.id))
}
