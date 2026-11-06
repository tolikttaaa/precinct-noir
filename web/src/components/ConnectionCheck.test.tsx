import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('ignores a probe that settles after unmount', async () => {
    const errors = vi.spyOn(console, 'error')
    const settle: Array<() => void> = []
    const pending = (outcome: 'resolve' | 'reject') => () =>
      new Promise<number>((resolve, reject) => {
        settle.push(() => (outcome === 'resolve' ? resolve(7) : reject(new Error('late'))))
      })

    render(<ConnectionCheck probe={pending('resolve')} />).unmount()
    render(<ConnectionCheck probe={pending('reject')} />).unmount()
    await act(async () => settle.forEach((fn) => fn()))

    expect(errors).not.toHaveBeenCalled()
  })

  it('keeps its state and does not re-probe when re-rendered with the same probe', async () => {
    const probe = vi.fn(() => Promise.resolve(5))
    const { rerender } = render(<ConnectionCheck probe={probe} />)
    await screen.findByText('Wire is live · 5 ms')

    rerender(<ConnectionCheck probe={probe} />)

    expect(screen.getByRole('status')).toHaveTextContent('Wire is live · 5 ms')
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
