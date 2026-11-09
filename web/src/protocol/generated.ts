// Generated from the Kotlin @Serializable protocol types by ProtocolTypesTest. Do not edit.
// Regenerate with: ./gradlew :server:generateProtocol

export type ClientMessage =
  | ClientMessageHello
  | ClientMessageRoomCommand

export interface ClientMessageHello {
  t: 'hello'
  room: string
  token: string
  lastEventSeq?: number
}

export type ClientMessageRoomCommand =
  | ClientMessageAct
  | ClientMessageEndGame
  | ClientMessageKick
  | ClientMessageLeave
  | ClientMessagePlayAgain
  | ClientMessageSetConfig
  | ClientMessageSetMode
  | ClientMessageSetTimer
  | ClientMessageShowGuide
  | ClientMessageStart

export interface ClientMessageAct {
  t: 'act'
  clientSeq: number
  decisionId: number
  choice: Choice
}

export type Choice =
  | CollapseChoice
  | PairChoice
  | PickChoice
  | ShiftChoice
  | SimpleChoice
  | SquareChoice
  | TargetChoice
  | TokenMoveChoice
  | VaultChoice

export interface CollapseChoice {
  t: 'collapse'
  action: string
  direction: CollapseDirection
  picks: SuspectId[]
}

export type CollapseDirection = 'columns' | 'rows'

export type SuspectId = number

export interface PairChoice {
  t: 'pair'
  action: string
  a: SuspectId
  b: SuspectId
}

export interface PickChoice {
  t: 'pick'
  action: string
  cards: SuspectId[]
}

export interface ShiftChoice {
  t: 'shift'
  action: string
  line: Line
  by: number
}

export interface Line {
  axis: Axis
  index: number
}

export type Axis = 'row' | 'col'

export interface SimpleChoice {
  t: 'simple'
  action: string
}

export interface SquareChoice {
  t: 'square'
  action: string
  corner: Pos
}

export interface Pos {
  row: number
  col: number
}

export interface TargetChoice {
  t: 'target'
  action: string
  target: SuspectId
}

export interface TokenMoveChoice {
  t: 'token_move'
  action: string
  kind: TokenKind
  from: SuspectId
  to: SuspectId
}

export type TokenKind = 'treasure' | 'protection' | 'threat' | 'bomb'

export interface VaultChoice {
  t: 'vault'
  action: string
  vault: Quadrant
}

export type Quadrant = 'nw' | 'ne' | 'sw' | 'se'

export interface ClientMessageEndGame {
  t: 'end_game'
  clientSeq: number
}

export interface ClientMessageKick {
  t: 'kick'
  clientSeq: number
  playerId: number
}

export interface ClientMessageLeave {
  t: 'leave'
  clientSeq: number
}

export interface ClientMessagePlayAgain {
  t: 'play_again'
  clientSeq: number
}

export interface ClientMessageSetConfig {
  t: 'set_config'
  clientSeq: number
  config: Record<string, unknown>
}

export interface ClientMessageSetMode {
  t: 'set_mode'
  clientSeq: number
  mode: string
}

export interface ClientMessageSetTimer {
  t: 'set_timer'
  clientSeq: number
  seconds?: number
}

export interface ClientMessageShowGuide {
  t: 'show_guide'
  clientSeq: number
  page?: number
}

export interface ClientMessageStart {
  t: 'start'
  clientSeq: number
}

export type ServerMessage =
  | ServerMessageAck
  | ServerMessageClosing
  | ServerMessageError
  | ServerMessageEvents
  | ServerMessageGame
  | ServerMessageNudge
  | ServerMessageRejected
  | ServerMessageRoom
  | ServerMessageWelcome

export interface ServerMessageAck {
  t: 'ack'
  clientSeq: number
}

export interface ServerMessageClosing {
  t: 'closing'
  reason: CloseReason
}

export type CloseReason = 'bad_token' | 'auth_timeout' | 'kicked' | 'room_closed' | 'hello_required' | 'left' | 'restarting'

export interface ServerMessageError {
  t: 'error'
  code: ProtocolError
}

export type ProtocolError = 'malformed' | 'already_authenticated' | 'server_error'

export interface ServerMessageEvents {
  t: 'events'
  round: number
  events: EventView[]
}

export interface EventView {
  seq: number
  event: unknown
}

export interface ServerMessageGame {
  t: 'game'
  round: number
  mode: string
  seat?: number
  view: unknown
  legal: Opt[]
}

export type Opt =
  | CollapseOpt
  | PairOpt
  | PickOpt
  | ShiftOpt
  | SimpleOpt
  | SquareOpt
  | TargetOpt
  | TokenMoveOpt
  | VaultOpt

export interface CollapseOpt {
  t: 'collapse'
  action: string
  options: CollapseOption[]
}

export interface CollapseOption {
  direction: CollapseDirection
  lines: SuspectId[][]
}

export interface PairOpt {
  t: 'pair'
  action: string
  pairs: SuspectPair[]
}

export interface SuspectPair {
  a: SuspectId
  b: SuspectId
}

export interface PickOpt {
  t: 'pick'
  action: string
  cards: SuspectId[]
  min: number
  max: number
}

export interface ShiftOpt {
  t: 'shift'
  action: string
  moves: ShiftMove[]
}

export interface ShiftMove {
  line: Line
  by: number
}

export interface SimpleOpt {
  t: 'simple'
  action: string
}

export interface SquareOpt {
  t: 'square'
  action: string
  size: number
  corners: Pos[]
}

export interface TargetOpt {
  t: 'target'
  action: string
  targets: SuspectId[]
}

export interface TokenMoveOpt {
  t: 'token_move'
  action: string
  moves: TokenMove[]
}

export interface TokenMove {
  kind: TokenKind
  from: SuspectId
  to: SuspectId
}

export interface VaultOpt {
  t: 'vault'
  action: string
  vaults: Quadrant[]
}

export interface ServerMessageNudge {
  t: 'nudge'
  event: unknown
}

export interface ServerMessageRejected {
  t: 'rejected'
  clientSeq: number
  reason: Refusal
}

export type Refusal = 'not_vip' | 'not_a_player' | 'wrong_status' | 'unknown_mode' | 'invalid_config' | 'invalid_timer' | 'invalid_target' | 'not_enough_players' | 'game_over' | 'not_your_decision' | 'stale_decision' | 'illegal_input' | 'malformed'

export interface ServerMessageRoom {
  t: 'room'
  room: RoomView
}

export interface RoomView {
  code: string
  status: RoomStatus
  version: number
  round: number
  vip?: number
  members: MemberView[]
  hostConnected: boolean
  mode: string
  config: Record<string, unknown>
  turnTimer?: number
  seats: number[]
  lastResult?: RoundResult
  guide?: number
}

export type RoomStatus = 'lobby' | 'in_game' | 'finished'

export interface MemberView {
  id: number
  name: string
  connected: boolean
}

export interface RoundResult {
  round: number
  kind: ResultKind
  outcome?: Outcome
}

export type ResultKind = 'finished' | 'ended_by_host' | 'idle_timeout' | 'restore_failed'

export interface Outcome {
  winners: Seat[]
  reason: string
}

export type Seat = number

export interface ServerMessageWelcome {
  t: 'welcome'
  you: You
  protocol: number
}

export interface You {
  role: Role
  playerId?: number
}

export type Role = 'host' | 'player'

export interface CreateRoomRequest {
  turnstileToken: string
  mode?: string
}

export interface CreateRoomResponse {
  code: string
  hostToken: string
}

export interface JoinRequest {
  name: string
}

export interface JoinResponse {
  playerId: number
  playerToken: string
}

export interface RoomSummary {
  code: string
  status: RoomStatus
  players: number
  maxPlayers: number
  mode: string
}

export interface ModeInfo {
  id: string
  minPlayers: number
  maxPlayers: number
  config: ConfigSpec
}

export interface ConfigSpec {
  options: ConfigOption[]
}

export type ConfigOption =
  | ConfigOptionRange
  | ConfigOptionToggle

export interface ConfigOptionRange {
  t: 'range'
  key: string
  min: number
  max: number
  default: number
}

export interface ConfigOptionToggle {
  t: 'toggle'
  key: string
  default: boolean
}

export interface ApiError {
  error: string
}

export interface ClientConfig {
  turnstileSiteKey?: string
  version?: string
  commit?: string
}

export interface ShadowDuelView {
  board: BoardView
  deckCount: number
  discard: SuspectId[]
  outOfPlay: SuspectId[]
  seats: SeatView[]
  kills: number
  killsToWin: number
  turn: number
  lastShift?: ShiftRecord
  interrogateDeadOnBoard: boolean
  pending?: PendingView
  outcome?: Outcome
  me?: MeView
  reveal?: Reveal
}

export interface BoardView {
  rows: number
  cols: number
  tiles: TileView[]
  removed: SuspectId[]
}

export interface TileView {
  id: SuspectId
  alive: boolean
  exonerated: boolean
  arrested: boolean
  officer?: Officer
  tokens: TokenKind[]
}

export interface Officer {
  stunned: boolean
}

export interface SeatView {
  seat: Seat
  role: ShadowDuelRole
  handCount: number
}

export type ShadowDuelRole = 'killer' | 'inspector'

export interface ShiftRecord {
  line: Line
  by: number
  length: number
}

export interface PendingView {
  id: number
  actor: Seat
  kind: PendingKind
  prompt: string
}

export type PendingKind = 'setup' | 'turn' | 'substep' | 'trigger' | 'reaction' | 'forced'

export interface MeView {
  seat: Seat
  role: ShadowDuelRole
  identity?: SuspectId
  hand: SuspectId[]
}

export interface Reveal {
  seats: SeatReveal[]
}

export interface SeatReveal {
  seat: Seat
  role: ShadowDuelRole
  identity?: SuspectId
  hand: SuspectId[]
}

export type ShadowDuelEvent =
  | ShadowDuelEventAccused
  | ShadowDuelEventCardsDrawn
  | ShadowDuelEventCollapsed
  | ShadowDuelEventDisguised
  | ShadowDuelEventExonerated
  | ShadowDuelEventGameOver
  | ShadowDuelEventGameStarted
  | ShadowDuelEventIdentityChosen
  | ShadowDuelEventKilled
  | ShadowDuelEventNudged
  | ShadowDuelEventShifted
  | ShadowDuelEventTurnStarted
  | ShadowDuelEventYouDrew
  | ShadowDuelEventYourIdentity

export interface ShadowDuelEventAccused {
  t: 'accused'
  seat: Seat
  target: SuspectId
  correct: boolean
}

export interface ShadowDuelEventCardsDrawn {
  t: 'cards_drawn'
  seat: Seat
  count: number
}

export interface ShadowDuelEventCollapsed {
  t: 'collapsed'
  seat: Seat
  direction: CollapseDirection
  removed: SuspectId[]
}

export interface ShadowDuelEventDisguised {
  t: 'disguised'
  seat: Seat
  exonerated?: SuspectId
  discarded?: SuspectId
}

export interface ShadowDuelEventExonerated {
  t: 'exonerated'
  seat: Seat
  card: SuspectId
  placed: boolean
  killerAdjacent?: boolean
}

export interface ShadowDuelEventGameOver {
  t: 'game_over'
  outcome: Outcome
  reveal: Reveal
}

export interface ShadowDuelEventGameStarted {
  t: 'game_started'
  killer: Seat
  inspector: Seat
}

export interface ShadowDuelEventIdentityChosen {
  t: 'identity_chosen'
  seat: Seat
}

export interface ShadowDuelEventKilled {
  t: 'killed'
  seat: Seat
  victim: SuspectId
  kills: number
  inspectorAdjacent?: boolean
}

export interface ShadowDuelEventNudged {
  t: 'nudged'
  seat: Seat
}

export interface ShadowDuelEventShifted {
  t: 'shifted'
  seat: Seat
  line: Line
  by: number
}

export interface ShadowDuelEventTurnStarted {
  t: 'turn_started'
  seat: Seat
  turn: number
}

export interface ShadowDuelEventYouDrew {
  t: 'you_drew'
  cards: SuspectId[]
}

export interface ShadowDuelEventYourIdentity {
  t: 'your_identity'
  card: SuspectId
}
