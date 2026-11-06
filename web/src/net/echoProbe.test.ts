import { afterEach, describe, expect, it, vi } from 'vitest'
import { AutoEchoWebSocket } from '../test/autoEchoWebSocket'
import { echoUrl, probeEcho } from './echoProbe'

type Behavior = 'echo' | 'silent'

/** Minimal stand-in for the browser WebSocket, driven manually by each test. */
class FakeSocket {
  readyState: number = WebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []
  closedWith: number | undefined
  private readonly behavior: Behavior

  constructor(behavior: Behavior) {
    this.behavior = behavior
  }

  open() {
    this.readyState = WebSocket.OPEN
    this.onopen?.()
  }

  receive(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  send(data: string) {
    this.sent.push(data)
    if (this.behavior === 'echo') this.receive(data)
  }

  close(code?: number) {
    this.closedWith = code
    this.readyState = WebSocket.CLOSED
  }
}

function startProbe(behavior: Behavior, options: { now?: () => number; timeoutMs?: number } = {}) {
  let socket!: FakeSocket
  const result = probeEcho('ws://test/ws/echo', {
    ...options,
    create: () => {
      socket = new FakeSocket(behavior)
      return socket as unknown as WebSocket
    },
  })
  return { result, socket }
}

describe('echoUrl', () => {
  it('uses wss on https pages and ws on http pages', () => {
    expect(echoUrl({ protocol: 'https:', host: 'precinctnoir.ttaaa.dev' })).toBe(
      'wss://precinctnoir.ttaaa.dev/ws/echo',
    )
    expect(echoUrl({ protocol: 'http:', host: 'localhost:5173' })).toBe(
      'ws://localhost:5173/ws/echo',
    )
  })
})

describe('echoUrl defaults', () => {
  it('uses the current page location when none is given', () => {
    expect(echoUrl()).toBe(`ws://${window.location.host}/ws/echo`)
  })
})

describe('probeEcho', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves with the round-trip time and closes the socket', async () => {
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(142)
    const { result, socket } = startProbe('echo', { now })
    socket.open()
    await expect(result).resolves.toBe(42)
    expect(socket.sent).toHaveLength(1)
    expect(socket.closedWith).toBe(1000)
  })

  it('ignores messages that are not its own ping', async () => {
    vi.useFakeTimers()
    const { result, socket } = startProbe('silent', { timeoutMs: 1000 })
    socket.open()
    socket.receive('someone else')
    vi.advanceTimersByTime(1000)
    await expect(result).rejects.toThrow('timeout')
  })

  it('rejects when the socket errors', async () => {
    const { result, socket } = startProbe('silent')
    socket.onerror?.()
    await expect(result).rejects.toThrow('error')
    expect(socket.closedWith).toBe(1000)
  })

  it('rejects when the server closes before answering', async () => {
    const { result, socket } = startProbe('silent')
    socket.open()
    socket.onclose?.()
    await expect(result).rejects.toThrow('closed')
  })

  it('does not close a socket that is already closed', async () => {
    const { result, socket } = startProbe('silent')
    socket.open()
    socket.readyState = WebSocket.CLOSED
    socket.onclose?.()
    await expect(result).rejects.toThrow('closed')
    expect(socket.closedWith).toBeUndefined()
  })

  it('defaults to the browser WebSocket and clock', async () => {
    vi.stubGlobal('WebSocket', AutoEchoWebSocket)
    const rtt = await probeEcho('ws://test/ws/echo')
    expect(rtt).toBeGreaterThanOrEqual(0)
    expect(AutoEchoWebSocket.instances.at(-1)?.readyState).toBe(AutoEchoWebSocket.CLOSED)
  })
})
