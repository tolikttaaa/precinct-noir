import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { loadCredentials } from '../net/credentials'
import type { TurnstileApi } from '../net/turnstile'
import { json, shadowDuel, stubFetch } from '../test/fixtures'
import { Home } from './Home'

function turnstile(answer: 'pass' | 'fail'): TurnstileApi {
  return {
    render: (_el, options) => {
      queueMicrotask(() =>
        answer === 'pass' ? options.callback('human') : options['error-callback'](),
      )
      return 'w'
    },
    remove: vi.fn(),
  }
}

describe('Home', () => {
  it('sends players to a room by its code', () => {
    render(<Home />)
    const code = screen.getByRole('textbox', { name: 'Room code' })
    fireEvent.change(code, { target: { value: 'bka' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(screen.getByText('Room codes are four letters, like BKTR.')).toBeInTheDocument()
    expect(code).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(code, { target: { value: 'bktr' } })
    expect(code).toHaveValue('BKTR')
    expect(screen.getByText('Four letters, shown on the board')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(window.location.pathname).toBe('/BKTR')
  })

  it('opens a room after the bot check and turns this screen into its board', async () => {
    window.turnstile = turnstile('pass')
    const fetchMock = stubFetch({
      'GET /api/config': () => json(200, { turnstileSiteKey: 'site' }),
      'GET /api/modes': () => json(200, [shadowDuel]),
      'POST /api/rooms': () => json(201, { code: 'BKTR', hostToken: 'host-token' }),
    })
    render(<Home />)
    const game = screen.getByRole('button', { name: 'Game Shadow Duel' })
    await waitFor(() => expect(game).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    expect(screen.getByRole('button', { name: 'Opening a room…' })).toBeDisabled()
    expect(game).toBeDisabled()
    await waitFor(() => expect(window.location.pathname).toBe('/tv/BKTR'))
    // One look at the settings serves both the version line and the bot check.
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.filter((url) => url === '/api/config')).toHaveLength(1)
    const create = fetchMock.mock.calls.find(([url]) => String(url) === '/api/rooms')!
    expect(create[1]!.body).toBe('{"turnstileToken":"human","mode":"killer_inspector"}')
    expect(loadCredentials('BKTR', 'host')).toEqual({
      token: 'host-token',
      playerId: undefined,
      clientSeq: 0,
    })
  })

  it.each([
    [
      'no site key',
      () => json(200, {}),
      'pass',
      'Opening rooms is unavailable right now. Try again in a minute.',
    ],
    [
      'a failed bot check',
      () => json(200, { turnstileSiteKey: 'site' }),
      'fail',
      "The bot check couldn't run. Check your connection and try again.",
    ],
  ] as const)('explains %s', async (_, config, answer, message) => {
    window.turnstile = turnstile(answer)
    stubFetch({ 'GET /api/config': config })
    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: 'Open a room' })).toBeEnabled()
  })

  it('lists every game on the secret page, with the ones still being built greyed out', async () => {
    stubFetch({ 'GET /api/modes': () => json(200, [shadowDuel]) })
    render(<Home />)
    const game = screen.getByRole('button', { name: 'Game Shadow Duel' })
    await waitFor(() => expect(game).toBeEnabled())
    fireEvent.click(game)
    expect(screen.getByRole('dialog', { name: 'Choose a game' })).toBeInTheDocument()
    expect(screen.getAllByText('Coming later')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: /^Choose / })).toBeNull()
  })

  it('opens the room in the game the host picked', async () => {
    window.turnstile = turnstile('pass')
    const fetchMock = stubFetch({
      'GET /api/config': () => json(200, { turnstileSiteKey: 'site' }),
      'GET /api/modes': () => json(200, [shadowDuel, { ...shadowDuel, id: 'spy_games' }]),
      'POST /api/rooms': () => json(201, { code: 'BKTR', hostToken: 'host-token' }),
    })
    render(<Home />)
    const game = screen.getByRole('button', { name: 'Game Shadow Duel' })
    await waitFor(() => expect(game).toBeEnabled())
    fireEvent.click(game)
    fireEvent.click(screen.getByRole('button', { name: 'Choose Spy Ring' }))
    expect(game).toHaveAccessibleName('Game Spy Ring')
    fireEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    await waitFor(() => expect(window.location.pathname).toBe('/tv/BKTR'))
    const create = fetchMock.mock.calls.find(([url]) => String(url) === '/api/rooms')!
    expect(create[1]!.body).toBe('{"turnstileToken":"human","mode":"spy_games"}')
  })

  it('still opens a room in the default game when the list of games is unavailable', async () => {
    window.turnstile = turnstile('pass')
    const fetchMock = stubFetch({
      'GET /api/config': () => json(200, { turnstileSiteKey: 'site' }),
      'GET /api/modes': () => json(503, { error: 'unavailable' }),
      'POST /api/rooms': () => json(201, { code: 'BKTR', hostToken: 'host-token' }),
    })
    render(<Home />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/modes', undefined))
    // Nothing to pick yet: the server hasn't said which games it has.
    expect(screen.getByRole('button', { name: 'Game Shadow Duel' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    await waitFor(() => expect(window.location.pathname).toBe('/tv/BKTR'))
    const create = fetchMock.mock.calls.find(([url]) => String(url) === '/api/rooms')!
    expect(create[1]!.body).toBe('{"turnstileToken":"human"}')
  })

  it('explains a game the server no longer offers', async () => {
    window.turnstile = turnstile('pass')
    stubFetch({
      'GET /api/config': () => json(200, { turnstileSiteKey: 'site' }),
      'POST /api/rooms': () => json(422, { error: 'unknown_mode' }),
    })
    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That game can’t be played yet. Pick another one.',
    )
  })

  it('says which version is running', async () => {
    stubFetch({ 'GET /api/config': () => json(200, { version: '0.1.0', commit: '1e96502aaaa' }) })
    render(<Home />)
    expect(await screen.findByText('Version 0.1.0 · 1e96502')).toBeInTheDocument()
  })

  it('explains a rate limit with the wait', async () => {
    window.turnstile = turnstile('pass')
    stubFetch({
      'GET /api/config': () => json(200, { turnstileSiteKey: 'site' }),
      'POST /api/rooms': () => json(429, { error: 'rate_limited' }, { 'Retry-After': '120' }),
    })
    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 2 min.')
  })
})
