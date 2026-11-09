import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GuideBoard, GuideSheet } from './Guide'

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }))
/** The sheet on top, the one being read (the others are copies for size and for the turn). */
const top = () => document.querySelector('.paper--current') as HTMLElement

describe('GuideSheet', () => {
  it('pages through the walkthrough', () => {
    const onClose = vi.fn()
    render(<GuideSheet mode="killer_inspector" onClose={onClose} />)
    expect(screen.getByRole('heading', { name: 'How to play Shadow Duel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Two hunters in one crowd' })).toBeInTheDocument()
    expect(screen.getByText('1 of 9')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(top().querySelectorAll('.diagram .diagram__cell')).toHaveLength(25)
    // The key names the two marks on this picture.
    expect([...top().querySelectorAll('.legend li')].map((li) => li.textContent)).toEqual([
      'KThe killer',
      'IThe inspector',
    ])
    next()
    expect(screen.getByRole('heading', { name: 'Your secret' })).toBeInTheDocument()
    expect(top().querySelector('.diagram')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('1 of 9')).toBeInTheDocument()
    for (let i = 0; i < 8; i++) next()
    expect(screen.getByRole('heading', { name: 'How it ends' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Show on the board' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('lets the VIP put the page on the board, follow it there and take it down', () => {
    const show = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(
      <GuideSheet mode="killer_inspector" onClose={onClose} board={{ showing: false, show }} />,
    )
    next()
    expect(show).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Show on the board' }))
    expect(show).toHaveBeenLastCalledWith(1)
    rerender(
      <GuideSheet
        mode="killer_inspector"
        onClose={onClose}
        closeLabel="Done"
        board={{ showing: true, show }}
      />,
    )
    next()
    expect(show).toHaveBeenLastCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: 'Hide from the board' }))
    expect(show).toHaveBeenLastCalledWith(null)
    show.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(show).toHaveBeenCalledWith(null)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows nothing for a mode without a walkthrough', () => {
    const { container } = render(<GuideSheet mode="spy_ring" onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('GuideBoard', () => {
  it('shows the chosen page with the room code, keeping the page in range', () => {
    const { rerender } = render(<GuideBoard mode="killer_inspector" page={3} code="BKTR" />)
    expect(screen.getByRole('heading', { name: 'Next to you' })).toBeInTheDocument()
    // The picture marks you, and its key says so.
    expect(
      within(top().querySelector('.diagram') as HTMLElement).getByText('You'),
    ).toBeInTheDocument()
    // The key is part of the picture, which screen readers skip: the page's text says it all.
    expect([...top().querySelectorAll('.legend li')].map((li) => li.textContent)).toEqual([
      'YouYou',
      'Next to you',
    ])
    expect(top().querySelector('.paper__picture')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Room BKTR')).toBeInTheDocument()
    rerender(<GuideBoard mode="killer_inspector" page={99} code="BKTR" />)
    expect(screen.getByText('9 of 9')).toBeInTheDocument()
    rerender(<GuideBoard mode="killer_inspector" page={-2} code="BKTR" />)
    expect(screen.getByText('1 of 9')).toBeInTheDocument()
  })

  it('shows nothing for a mode without a walkthrough', () => {
    const { container } = render(<GuideBoard mode="spy_ring" page={0} code="BKTR" />)
    expect(container).toBeEmptyDOMElement()
  })
})
