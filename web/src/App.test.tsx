import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { navigate } from './routing'
import { FakeWebSocket } from './test/fakeWebSocket'
import { json, stubFetch } from './test/fixtures'

describe('App', () => {
  it('shows the screen for the address', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    stubFetch({ 'GET /api/rooms/BKTR': () => json(404, { error: 'room_not_found' }) })
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Precinct Noir' })).toBeInTheDocument()
    act(() => navigate('/tv/BKTR'))
    expect(
      screen.getByRole('heading', { name: 'This screen isn’t the board for room BKTR.' }),
    ).toBeInTheDocument()
    act(() => navigate('/bktr'))
    expect(
      await screen.findByText('No room has the code BKTR. Check the code on the board.'),
    ).toBeInTheDocument()
    act(() => navigate('/nowhere/at/all'))
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the start' })).toHaveAttribute('href', '/')
  })
})
