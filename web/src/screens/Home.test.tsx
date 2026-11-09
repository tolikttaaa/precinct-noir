import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { loadCredentials } from '../net/credentials'
import type { TurnstileApi } from '../net/turnstile'
import { json, stubFetch } from '../test/fixtures'
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
      'POST /api/rooms': () => json(201, { code: 'BKTR', hostToken: 'host-token' }),
    })
    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    expect(screen.getByRole('button', { name: 'Opening a room…' })).toBeDisabled()
    await waitFor(() => expect(window.location.pathname).toBe('/tv/BKTR'))
    // One look at the settings serves both the version line and the bot check.
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['/api/config', '/api/rooms'])
    expect(fetchMock.mock.calls[1][1]!.body).toBe('{"turnstileToken":"human"}')
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
