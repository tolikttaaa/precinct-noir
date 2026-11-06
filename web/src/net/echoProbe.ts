/** Builds the echo endpoint URL for the current page (wss on https, ws on http). */
export function echoUrl(location: Pick<Location, 'protocol' | 'host'> = window.location): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}/ws/echo`
}

export interface ProbeOptions {
  timeoutMs?: number
  create?: (url: string) => WebSocket
  now?: () => number
}

/**
 * Opens the echo WebSocket, sends one ping and resolves with the round-trip time in ms.
 * Rejects on error, early close or timeout. The socket is always closed afterwards.
 */
export function probeEcho(url: string, options: ProbeOptions = {}): Promise<number> {
  const {
    timeoutMs = 5000,
    create = (u) => new WebSocket(u),
    now = () => performance.now(),
  } = options

  return new Promise((resolve, reject) => {
    const ws = create(url)
    const token = `ping:${Math.random().toString(36).slice(2)}`
    let sentAt = 0

    const finish = (outcome: () => void) => {
      clearTimeout(timer)
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close(1000)
      outcome()
    }

    const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), timeoutMs)

    ws.onopen = () => {
      sentAt = now()
      ws.send(token)
    }
    ws.onmessage = (event: MessageEvent) => {
      if (event.data === token) finish(() => resolve(Math.round(now() - sentAt)))
    }
    ws.onerror = () => finish(() => reject(new Error('error')))
    ws.onclose = () => finish(() => reject(new Error('closed')))
  })
}
