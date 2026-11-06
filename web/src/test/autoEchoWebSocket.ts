/**
 * Browser-like WebSocket stand-in for tests that use the real defaults: it "connects" on the
 * next tick and echoes every text frame back. Install with `vi.stubGlobal('WebSocket', AutoEchoWebSocket)`.
 */
export class AutoEchoWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static readonly instances: AutoEchoWebSocket[] = []

  readonly url: string
  readyState = AutoEchoWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    AutoEchoWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = AutoEchoWebSocket.OPEN
      this.onopen?.()
    }, 0)
  }

  send(data: string) {
    setTimeout(() => this.onmessage?.(new MessageEvent('message', { data })), 0)
  }

  close() {
    this.readyState = AutoEchoWebSocket.CLOSED
  }
}
