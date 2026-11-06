import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeWebSocket } from '../test/fakeWebSocket'
import { roomView } from '../test/fixtures'
import { RoomSocket, socketUrl } from './roomSocket'

describe('RoomSocket', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function connect() {
    const saved: number[] = []
    const socket = new RoomSocket({
      url: 'ws://test/ws',
      room: 'BKTR',
      token: 'secret',
      clientSeq: 4,
      onClientSeq: (seq) => saved.push(seq),
    })
    socket.start()
    return { socket, ws: FakeWebSocket.latest(), saved }
  }

  const welcome = { t: 'welcome', you: { role: 'player', playerId: 1 }, protocol: 1 } as const

  it('says hello, then keeps the room, the game and the case log', () => {
    const { socket, ws } = connect()
    const changes = vi.fn()
    const unsubscribe = socket.subscribe(changes)
    expect(ws.url).toBe('ws://test/ws')
    expect(socket.getState().connection).toBe('connecting')

    ws.open()
    expect(ws.sent).toEqual([{ t: 'hello', room: 'BKTR', token: 'secret' }])
    ws.receive(welcome)
    ws.receive({ t: 'room', room: roomView() })
    ws.receive({
      t: 'game',
      round: 1,
      mode: 'killer_inspector',
      seat: 0,
      view: { a: 1 },
      legal: [],
    })
    ws.receive({
      t: 'events',
      round: 1,
      events: [
        { seq: 5, event: 'a' },
        { seq: 6, event: 'b' },
      ],
    })
    ws.receive({
      t: 'events',
      round: 1,
      events: [
        { seq: 6, event: 'b' },
        { seq: 7, event: 'c' },
      ],
    })
    ws.receive({ t: 'game', round: 1, mode: 'killer_inspector', view: { a: 2 }, legal: [] })
    let state = socket.getState()
    expect(state.connection).toBe('open')
    expect(state.you).toEqual({ role: 'player', playerId: 1 })
    expect(state.room?.code).toBe('BKTR')
    expect(state.game?.view).toEqual({ a: 2 })
    expect(state.events.map((e) => e.seq)).toEqual([5, 6, 7])

    // A new round replaces the log, whichever message announces it first.
    ws.receive({ t: 'events', round: 2, events: [{ seq: 9, event: 'd' }] })
    expect(socket.getState()).toMatchObject({ round: 2, events: [{ seq: 9, event: 'd' }] })
    ws.receive({ t: 'game', round: 3, mode: 'killer_inspector', view: {}, legal: [] })
    expect(socket.getState()).toMatchObject({ round: 3, events: [] })

    ws.receive({ t: 'nudge', event: {} })
    ws.receive({ t: 'error', code: 'server_error' })
    ws.receive({ t: 'closing', reason: 'restarting' })
    ws.receiveRaw('not json')
    state = socket.getState()
    expect(state.nudges).toBe(1)
    expect(state.error).toBe('server_error')
    ws.receive(welcome)
    expect(socket.getState().error).toBeUndefined()

    expect(changes).toHaveBeenCalled()
    const calls = changes.mock.calls.length
    unsubscribe()
    ws.receive({ t: 'nudge', event: {} })
    expect(changes).toHaveBeenCalledTimes(calls)
  })

  it('numbers commands, sends them once connected and resends unacknowledged ones after a reconnect', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const { socket, ws, saved } = connect()
    expect(socket.send({ t: 'start' })).toBe(5)
    expect(saved).toEqual([5])
    ws.open()
    expect(ws.commands()).toEqual([]) // not before the welcome
    ws.receive(welcome)
    expect(ws.commands()).toEqual([{ t: 'start', clientSeq: 5 }])

    expect(socket.send({ t: 'kick', playerId: 2 })).toBe(6)
    expect(ws.commands().at(-1)).toEqual({ t: 'kick', clientSeq: 6, playerId: 2 })
    ws.receive({ t: 'ack', clientSeq: 5 })
    ws.receive({ t: 'rejected', clientSeq: 6, reason: 'not_vip' })
    expect(socket.getState().refusal).toEqual({ reason: 'not_vip', id: 1 })
    ws.receive({ t: 'events', round: 1, events: [{ seq: 3, event: 'x' }] })
    socket.send({ t: 'leave' })

    ws.drop(1012)
    expect(socket.getState().connection).toBe('reconnecting')
    vi.advanceTimersByTime(500)
    const again = FakeWebSocket.latest()
    expect(again).not.toBe(ws)
    again.open()
    expect(again.sent[0]).toEqual({ t: 'hello', room: 'BKTR', token: 'secret', lastEventSeq: 3 })
    again.receive(welcome)
    expect(again.commands()).toEqual([{ t: 'leave', clientSeq: 7 }])
    expect(saved).toEqual([5, 6, 7])
  })

  it('waits longer after each failed attempt, up to a ceiling, and starts over after a welcome', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0) // shortest jitter: half of each step
    const { ws } = connect()
    let current = ws
    for (const wait of [250, 500, 1000, 2000, 4000, 5000, 5000]) {
      current.drop(1006)
      vi.advanceTimersByTime(wait - 1)
      expect(FakeWebSocket.latest()).toBe(current)
      vi.advanceTimersByTime(1)
      current = FakeWebSocket.latest()
    }
    current.open()
    current.receive(welcome)
    current.drop(1013)
    vi.advanceTimersByTime(250)
    expect(FakeWebSocket.latest()).not.toBe(current)
  })

  it.each([
    [1000, 'left'],
    [4001, 'bad_token'],
    [4003, 'kicked'],
    [4004, 'room_closed'],
  ] as const)('stops for good after close code %i (%s)', (code, ending) => {
    vi.useFakeTimers()
    const { socket, ws } = connect()
    ws.open()
    ws.drop(code)
    vi.advanceTimersByTime(60_000)
    expect(socket.getState().ending).toBe(ending)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('stops when the screen goes away, ignores the old socket, and can start again', () => {
    vi.useFakeTimers()
    const { socket, ws } = connect()
    socket.start() // already running: no second socket
    expect(FakeWebSocket.instances).toHaveLength(1)
    socket.stop()
    expect(ws.closedWith).toBe(1000)
    ws.receive(welcome)
    ws.drop(1006)
    vi.advanceTimersByTime(60_000)
    expect(socket.getState().connection).toBe('connecting')
    expect(FakeWebSocket.instances).toHaveLength(1)
    socket.start()
    expect(FakeWebSocket.instances).toHaveLength(2)
    socket.stop()
    socket.stop() // nothing left to close
  })

  it('stops a pending reconnect', () => {
    vi.useFakeTimers()
    const { socket, ws } = connect()
    ws.drop(1006)
    socket.stop()
    vi.advanceTimersByTime(60_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})

describe('socketUrl', () => {
  it('uses wss behind https and ws otherwise', () => {
    expect(socketUrl({ protocol: 'https:', host: 'precinct.example' } as Location)).toBe(
      'wss://precinct.example/ws',
    )
    expect(socketUrl({ protocol: 'http:', host: 'localhost:5173' } as Location)).toBe(
      'ws://localhost:5173/ws',
    )
    expect(socketUrl()).toBe(`ws://${window.location.host}/ws`)
  })
})
