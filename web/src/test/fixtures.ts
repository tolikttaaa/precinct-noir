import { act } from '@testing-library/react'
import { vi } from 'vitest'
import type { MemberView, ModeInfo, RoomView, ServerMessage, You } from '../protocol/generated'
import { FakeWebSocket } from './fakeWebSocket'

export const member = (id: number, name: string, connected = true): MemberView => ({
  id,
  name,
  connected,
})

export function roomView(patch: Partial<RoomView> = {}): RoomView {
  return {
    code: 'BKTR',
    status: 'lobby',
    version: 1,
    round: 0,
    vip: 1,
    members: [member(1, 'Ann'), member(2, 'Bob')],
    hostConnected: true,
    mode: 'killer_inspector',
    config: { interrogateDeadOnBoard: true },
    seats: [],
    ...patch,
  }
}

export const shadowDuel: ModeInfo = {
  id: 'killer_inspector',
  minPlayers: 2,
  maxPlayers: 2,
  config: { options: [{ t: 'toggle', key: 'interrogateDeadOnBoard', default: true }] },
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

type Route = (init?: RequestInit) => Response | Promise<Response>

/** Stubs `fetch` with routes like `'GET /api/modes'`. Anything else fails like a network error. */
export function stubFetch(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const route = routes[`${init?.method ?? 'GET'} ${String(input)}`]
    if (!route) throw new TypeError(`no route for ${init?.method ?? 'GET'} ${String(input)}`)
    return route(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Opens the latest socket and walks it through the hello: welcome, then [messages] (inside `act`). */
export function serve(you: You, ...messages: ServerMessage[]): FakeWebSocket {
  const socket = FakeWebSocket.latest()
  act(() => {
    socket.open()
    socket.receive({ t: 'welcome', you, protocol: 1 })
    messages.forEach((m) => socket.receive(m))
  })
  return socket
}

/** Pushes server messages to [socket] inside `act`. */
export function push(socket: FakeWebSocket, ...messages: ServerMessage[]): void {
  act(() => messages.forEach((m) => socket.receive(m)))
}
