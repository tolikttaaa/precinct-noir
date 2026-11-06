import { describe, expect, it } from 'vitest'
import { json, stubFetch } from '../test/fixtures'
import { api, ApiError } from './api'

describe('api', () => {
  it('calls the room endpoints with JSON bodies', async () => {
    const fetchMock = stubFetch({
      'GET /api/config': () => json(200, { turnstileSiteKey: 'site' }),
      'GET /api/modes': () => json(200, []),
      'GET /api/rooms/BKTR': () => json(200, { code: 'BKTR' }),
      'POST /api/rooms': () => json(201, { code: 'BKTR', hostToken: 'h' }),
      'POST /api/rooms/BKTR/players': () => json(201, { playerId: 1, playerToken: 'p' }),
    })
    expect(await api.config()).toEqual({ turnstileSiteKey: 'site' })
    expect(await api.modes()).toEqual([])
    expect(await api.summary('BKTR')).toEqual({ code: 'BKTR' })
    expect(await api.createRoom('tok')).toEqual({ code: 'BKTR', hostToken: 'h' })
    expect(await api.join('BKTR', 'Ann')).toEqual({ playerId: 1, playerToken: 'p' })
    const join = fetchMock.mock.calls.at(-1)![1]!
    expect(join.body).toBe('{"name":"Ann"}')
    expect(join.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(fetchMock.mock.calls[3][1]!.body).toBe('{"turnstileToken":"tok"}')
  })

  it('turns refusals into errors with the server code and any wait', async () => {
    stubFetch({
      'POST /api/rooms': () => json(429, { error: 'rate_limited' }, { 'Retry-After': '90' }),
      'GET /api/rooms/ZZZZ': () => json(404, { error: 'room_not_found' }),
      'GET /api/modes': () => new Response('<html>', { status: 502 }),
    })
    await expect(api.createRoom('t')).rejects.toEqual(new ApiError(429, 'rate_limited', 90))
    const missing = (await api.summary('ZZZZ').catch((e: unknown) => e)) as ApiError
    expect([missing.status, missing.code, missing.retryAfter]).toEqual([
      404,
      'room_not_found',
      undefined,
    ])
    await expect(api.modes()).rejects.toMatchObject({ status: 502, code: 'unexpected' })
    await expect(api.config()).rejects.toMatchObject({ status: 0, code: 'network' })
  })
})
