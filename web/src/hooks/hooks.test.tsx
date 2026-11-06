import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { loadCredentials } from '../net/credentials'
import { FakeWebSocket } from '../test/fakeWebSocket'
import { json, roomView, serve, shadowDuel, stubFetch } from '../test/fixtures'
import { useModes } from './useModes'
import { useRoom } from './useRoom'

describe('useRoom', () => {
  it('connects while mounted, saves command numbers and disconnects on unmount', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const credentials = { token: 'p', playerId: 1, clientSeq: 2 }
    const { result, unmount } = renderHook(() => useRoom('BKTR', 'player', credentials))
    const ws = serve({ role: 'player', playerId: 1 }, { t: 'room', room: roomView() })
    expect(result.current.state.room?.code).toBe('BKTR')
    act(() => result.current.send({ t: 'start' }))
    expect(ws.commands()).toEqual([{ t: 'start', clientSeq: 3 }])
    expect(loadCredentials('BKTR', 'player')).toEqual({ ...credentials, clientSeq: 3 })
    unmount()
    expect(ws.closedWith).toBe(1000)
  })
})

describe('useModes', () => {
  it('fetches the modes once and shares them', async () => {
    const fetchMock = stubFetch({ 'GET /api/modes': () => json(200, [shadowDuel]) })
    const first = renderHook(() => useModes())
    await waitFor(() => expect(first.result.current).toEqual([shadowDuel]))
    const second = renderHook(() => useModes())
    await waitFor(() => expect(second.result.current).toEqual([shadowDuel]))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tries again on the next use after a failure, and ignores answers after unmount', async () => {
    const fetchMock = stubFetch({ 'GET /api/modes': () => json(500, { error: 'boom' }) })
    const failed = renderHook(() => useModes())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => undefined)
    expect(failed.result.current).toBeUndefined()
    stubFetch({ 'GET /api/modes': () => json(200, [shadowDuel]) })
    const gone = renderHook(() => useModes())
    gone.unmount()
    const retried = renderHook(() => useModes())
    await waitFor(() => expect(retried.result.current).toEqual([shadowDuel]))
  })
})
