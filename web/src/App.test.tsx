import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AutoEchoWebSocket } from './test/autoEchoWebSocket'

describe('App', () => {
  it('renders the case file and checks the live wire on the current host', async () => {
    vi.stubGlobal('WebSocket', AutoEchoWebSocket)
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Precinct Noir' })).toBeInTheDocument()
    expect(await screen.findByText(/^Wire is live · \d+ ms$/)).toBeInTheDocument()
    expect(AutoEchoWebSocket.instances.at(-1)?.url).toBe(`ws://${window.location.host}/ws/echo`)
  })

  it('re-renders from its memoized output without probing again', async () => {
    vi.stubGlobal('WebSocket', AutoEchoWebSocket)
    const { rerender } = render(<App />)
    await screen.findByText(/^Wire is live/)
    const sockets = AutoEchoWebSocket.instances.length

    rerender(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Precinct Noir')
    expect(AutoEchoWebSocket.instances).toHaveLength(sockets)
  })
})
