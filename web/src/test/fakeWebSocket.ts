import type { ClientMessage, ServerMessage } from '../protocol/generated'

/** A WebSocket the test drives by hand: open it, push server messages, drop it with a close code. */
export class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  readonly sent: ClientMessage[] = []
  closedWith?: number
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  static reset(): void {
    FakeWebSocket.instances = []
  }

  static latest(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1)
    if (!socket) throw new Error('no socket was opened')
    return socket
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ClientMessage)
  }

  close(code = 1000): void {
    this.closedWith = code
    this.readyState = FakeWebSocket.CLOSED
  }

  // --- Driven by tests ---

  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  receive(message: ServerMessage): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }

  receiveRaw(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  drop(code: number): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { code }))
  }

  /** The messages sent so far, without the hello. */
  commands(): ClientMessage[] {
    return this.sent.filter((m) => m.t !== 'hello')
  }
}
