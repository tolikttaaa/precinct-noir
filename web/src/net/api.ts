import type {
  ClientConfig,
  CreateRoomResponse,
  JoinResponse,
  ModeInfo,
  RoomSummary,
} from '../protocol/generated'

/** A refused or failed API call. [code] is the server's i18n code, or `network` if it was never reached. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Seconds to wait, when the server says so (rate limits). */
  readonly retryAfter?: number

  constructor(status: number, code: string, retryAfter?: number) {
    super(code)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError(0, 'network')
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const code = (body as { error?: unknown } | null)?.error
    const retryAfter = Number(res.headers.get('Retry-After'))
    throw new ApiError(
      res.status,
      typeof code === 'string' ? code : 'unexpected',
      retryAfter > 0 ? retryAfter : undefined,
    )
  }
  return body as T
}

function post(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const api = {
  config: () => call<ClientConfig>('/api/config'),
  modes: () => call<ModeInfo[]>('/api/modes'),
  summary: (code: string) => call<RoomSummary>(`/api/rooms/${code}`),
  createRoom: (turnstileToken: string) =>
    call<CreateRoomResponse>('/api/rooms', post({ turnstileToken })),
  join: (code: string, name: string) =>
    call<JoinResponse>(`/api/rooms/${code}/players`, post({ name })),
}
