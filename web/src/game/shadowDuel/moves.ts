import type {
  Choice,
  CollapseOption,
  EventView,
  Line,
  Opt,
  PickOpt,
  RoomView,
  ShadowDuelEvent,
  ShadowDuelView,
} from '../../protocol/generated'
import type { RoomState } from '../../net/roomSocket'

export const SHADOW_DUEL = 'killer_inspector'

/** This device's view of a Shadow Duel, from the latest `game` message. */
export interface DuelGame {
  readonly view: ShadowDuelView
  readonly legal: readonly Opt[]
  readonly events: readonly ShadowDuelEvent[]
}

/** The running (or just finished) Shadow Duel for this room, if that's what the server sent. */
export function duelOf(state: RoomState, room: RoomView): DuelGame | undefined {
  const game = state.game
  if (room.status === 'lobby' || game?.mode !== SHADOW_DUEL || game.round !== room.round) {
    return undefined
  }
  return {
    view: game.view as ShadowDuelView,
    legal: game.legal,
    events: state.events.map((e: EventView) => e.event as ShadowDuelEvent),
  }
}

/** The server's legal options, read the way the phone's controls need them. No hidden state is derived here. */
export interface Moves {
  /** The suspects you can kill or accuse, and which of the two it is. */
  readonly target?: { readonly action: TargetAction; readonly ids: ReadonlySet<number> }
  readonly shifts: readonly { readonly line: Line; readonly by: number }[]
  readonly collapse?: readonly CollapseOption[]
  /** One-tap actions: disguise, exonerate, stop collapsing. */
  readonly simple: readonly string[]
  readonly pick?: PickOpt
}

export type TargetAction = 'kill' | 'accuse'

export function readMoves(legal: readonly Opt[]): Moves {
  let target: Moves['target']
  let shifts: Moves['shifts'] = []
  let collapse: Moves['collapse']
  let pick: PickOpt | undefined
  const simple: string[] = []
  for (const opt of legal) {
    if (opt.t === 'target' && (opt.action === 'kill' || opt.action === 'accuse')) {
      target = { action: opt.action, ids: new Set(opt.targets) }
    } else if (opt.t === 'shift') shifts = opt.moves
    else if (opt.t === 'collapse') collapse = opt.options
    else if (opt.t === 'simple') simple.push(opt.action)
    else if (opt.t === 'pick') pick = opt
  }
  return { target, shifts, collapse, simple, pick }
}

export function canShift(moves: Moves, line: Line, by: number): boolean {
  return moves.shifts.some(
    (m) => m.line.axis === line.axis && m.line.index === line.index && m.by === by,
  )
}

/** Picks for a collapse: a line with a single body picks itself; [chosen] (by line) fills in the rest. */
export function collapsePicks(
  option: CollapseOption,
  chosen: ReadonlyMap<number, number>,
): (number | undefined)[] {
  return option.lines.map((line, i) => (line.length === 1 ? line[0] : chosen.get(i)))
}

/** Builds the `act` choice for each kind of move. */
export const choice = {
  target: (action: TargetAction, id: number): Choice => ({ t: 'target', action, target: id }),
  shift: (line: Line, by: number): Choice => ({ t: 'shift', action: 'shift', line, by }),
  collapse: (option: CollapseOption, picks: number[]): Choice => ({
    t: 'collapse',
    action: 'collapse',
    direction: option.direction,
    picks,
  }),
  simple: (action: string): Choice => ({ t: 'simple', action }),
  pick: (action: string, id: number): Choice => ({ t: 'pick', action, cards: [id] }),
}

/** The player sitting in [seat], by name, from the room's seat list. */
export function seatName(room: RoomView, seat: number): string {
  const id = room.seats[seat]
  return room.members.find((m) => m.id === id)?.name ?? '?'
}
