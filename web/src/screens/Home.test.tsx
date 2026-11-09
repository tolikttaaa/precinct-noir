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
    expect(await screen.findByRole('radio', { name: 'Shadow Duel, 2 players' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    expect(screen.getByRole('button', { name: 'Opening a room…' })).toBeDisabled()
    expect(screen.getByRole('group', { name: 'Game' })).toBeDisabled()
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

  it('lists every game, with the ones still being built marked and out of reach', async () => {
    stubFetch({ 'GET /api/modes': () => json(200, [shadowDuel]) })
    render(<Home />)
    const later = await screen.findByRole('radio', {
      name: 'Spy Ring, Coming later, 3–6, 8 or 9 players',
    })
    expect(later).toBeDisabled()
    for (const name of [
      'The Hit List, Coming later, 2 players',
      'Cat Burglar, Coming later, 2 players',
      'Feds vs. Mob, Coming later, 6 or 8 players',
      'Casino Heist, Coming later, 5–7 players',
    ])
      expect(screen.getByRole('radio', { name })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Shadow Duel, 2 players' })).toBeEnabled()
  })

  it('opens the room in the game the host picked', async () => {
    window.turnstile = turnstile('pass')
    const fetchMock = stubFetch({
      'GET /api/config': () => json(200, { turnstileSiteKey: 'site' }),
      'GET /api/modes': () => json(200, [shadowDuel, { ...shadowDuel, id: 'spy_games' }]),
      'POST /api/rooms': () => json(201, { code: 'BKTR', hostToken: 'host-token' }),
    })
    render(<Home />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Spy Ring, 3–6, 8 or 9 players' }))
    expect(screen.getByRole('radio', { name: 'Shadow Duel, 2 players' })).not.toBeChecked()
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
    // Nothing to pick yet, and nothing marked as coming later: the server hasn't said.
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.queryByText('Coming later')).toBeNull()
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
