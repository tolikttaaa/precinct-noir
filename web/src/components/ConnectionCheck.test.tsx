import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConnectionCheck } from './ConnectionCheck'

describe('ConnectionCheck', () => {
  it('starts in the checking state', () => {
    render(<ConnectionCheck probe={() => new Promise(() => {})} />)
    expect(screen.getByRole('status')).toHaveTextContent('Checking the wire…')
  })

  it('shows the round trip when the wire is live', async () => {
    render(<ConnectionCheck probe={() => Promise.resolve(42)} />)
    expect(await screen.findByText('Wire is live · 42 ms')).toBeInTheDocument()
  })

  it('reports a dead wire when the probe fails', async () => {
    render(<ConnectionCheck probe={() => Promise.reject(new Error('closed'))} />)
    expect(await screen.findByText(/Wire is dead/)).toBeInTheDocument()
  })
})
