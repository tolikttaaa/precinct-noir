import type {
  ClientMessage,
  ClientMessageRoomCommand,
  EventView,
  ProtocolError,
  Refusal,
  RoomView,
  ServerMessage,
  ServerMessageGame,
  You,
} from '../protocol/generated'

export type Connection = 'connecting' | 'open' | 'reconnecting'

/** Why this device is out of the room for good: no reconnecting after these. */
export type Ending = 'bad_token' | 'kicked' | 'room_closed' | 'left'

export interface RoomState {
  readonly connection: Connection
  readonly ending?: Ending
  readonly you?: You
  readonly room?: RoomView
  /** The latest game view for this device (meaningful while the room isn't in the lobby). */
  readonly game?: ServerMessageGame
  readonly round: number
  /** This round's case log, in order. */
  readonly events: readonly EventView[]
  /**
   * Events up to this `seq` were caught up on when connecting, not seen as they happened: screens show
   * them without their sounds.
   */
  readonly replayedTo: number
  /** The last refused command; `id` changes on every refusal. */
  readonly refusal?: { readonly reason: Refusal; readonly id: number }
  readonly error?: ProtocolError
  /** Bumps when the turn timer runs out for the pending decision. */
  readonly nudges: number
}

/** A command without its `clientSeq`, which the socket assigns. */
export type Command = ClientMessageRoomCommand extends infer C
  ? C extends ClientMessageRoomCommand
    ? Omit<C, 'clientSeq'>
    : never
  : never

export interface RoomSocketOptions {
  readonly url: string
  readonly room: string
  readonly token: string
  /** The last `clientSeq` this device used in the room; new commands continue from it. */
  readonly clientSeq: number
  readonly onClientSeq?: (clientSeq: number) => void
}

const ENDINGS: Readonly<Record<number, Ending>> = {
  1000: 'left',
  4001: 'bad_token',
  4003: 'kicked',
  4004: 'room_closed',
}

const FIRST_RETRY_MS = 500
const MAX_RETRY_MS = 10_000

/**
 * One device's connection to a room (docs/PROTOCOL.md §2). Says hello, keeps the room and game state,
 * and reconnects with backoff after drops and deploys, resuming the case log where it left off.
 * Commands are numbered; any not yet acknowledged are resent after a reconnect (the server ignores
 * repeats).
 */
export class RoomSocket {
  private readonly options: RoomSocketOptions
  private readonly listeners = new Set<() => void>()
  private readonly pending = new Map<number, ClientMessage>()
  private state: RoomState = {
    connection: 'connecting',
    round: 0,
    events: [],
    replayedTo: 0,
    nudges: 0,
  }
  private socket?: WebSocket
  private retryTimer?: ReturnType<typeof setTimeout>
  private attempts = 0
  private clientSeq: number
  private refusals = 0
  private stopped = true

  constructor(options: RoomSocketOptions) {
    this.options = options
    this.clientSeq = options.clientSeq
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getState = (): RoomState => this.state

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.connect()
  }

  /** Closes the connection (the page is leaving the room screen). [start] opens it again. */
  stop(): void {
    this.stopped = true
    clearTimeout(this.retryTimer)
    const socket = this.socket
    this.socket = undefined
    socket?.close(1000)
  }

  /** Sends [command] now if connected, otherwise once reconnected. Returns its `clientSeq`. */
  send(command: Command): number {
    const message = { ...command, clientSeq: ++this.clientSeq } as ClientMessageRoomCommand
    this.options.onClientSeq?.(this.clientSeq)
    this.pending.set(message.clientSeq, message)
    if (this.state.connection === 'open') this.transmit(message)
    return message.clientSeq
  }

  private connect(): void {
    const socket = new WebSocket(this.options.url)
    this.socket = socket
    socket.onopen = () => {
      const lastEventSeq = this.state.events.at(-1)?.seq
      this.transmit({
        t: 'hello',
        room: this.options.room,
        token: this.options.token,
        lastEventSeq,
      })
    }
    socket.onmessage = (event: MessageEvent) => {
      if (this.socket === socket) this.receive(String(event.data))
    }
    socket.onclose = (event: CloseEvent) => {
      if (this.socket === socket) this.closed(event.code)
    }
  }

  private receive(data: string): void {
    let message: ServerMessage
    try {
      message = JSON.parse(data) as ServerMessage
    } catch {
      return
    }
    switch (message.t) {
      case 'welcome':
        this.attempts = 0
        this.update({ connection: 'open', you: message.you, error: undefined })
        this.pending.forEach((command) => this.transmit(command))
        break
      case 'room':
        this.update({ room: message.room })
        break
      case 'game':
        this.update(
          message.round === this.state.round
            ? { game: message }
            : { game: message, round: message.round, events: [] },
        )
        break
      case 'events':
        this.addEvents(message.round, message.events)
        if (message.replay) {
          this.update({
            replayedTo: Math.max(this.state.replayedTo, ...message.events.map((e) => e.seq)),
          })
        }
        break
      case 'nudge':
        this.update({ nudges: this.state.nudges + 1 })
        break
      case 'ack':
        this.pending.delete(message.clientSeq)
        break
      case 'rejected':
        this.pending.delete(message.clientSeq)
        this.update({ refusal: { reason: message.reason, id: ++this.refusals } })
        break
      case 'error':
        this.update({ error: message.code })
        break
      case 'closing':
        break // the close code that follows says the same
    }
  }

  private addEvents(round: number, events: readonly EventView[]): void {
    if (round !== this.state.round) {
      this.update({ round, events })
      return
    }
    const last = this.state.events.at(-1)?.seq ?? 0
    this.update({ events: [...this.state.events, ...events.filter((e) => e.seq > last)] })
  }

  private closed(code: number): void {
    this.socket = undefined
    const ending = ENDINGS[code]
    if (ending) {
      this.stopped = true
      this.update({ ending })
      return
    }
    // Drops, deploys (1012) and overload (1013): try again after growing, jittered delays, so a whole
    // room doesn't reconnect in the same instant.
    this.attempts++
    const ceiling = Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** (this.attempts - 1))
    this.update({ connection: 'reconnecting' })
    this.retryTimer = setTimeout(() => this.connect(), ceiling * (0.5 + Math.random() / 2))
  }

  private transmit(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  private update(patch: Partial<RoomState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
}

/** The game socket's URL for this page. */
export function socketUrl(location: Location = window.location): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
}
