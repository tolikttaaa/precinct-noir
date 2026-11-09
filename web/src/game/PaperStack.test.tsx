import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { play } from '../sound/sound'
import { GUIDES } from './guides'
import { PaperStack } from './PaperStack'

vi.mock('../sound/sound', async (actual) => ({
  ...(await actual<typeof import('../sound/sound')>()),
  play: vi.fn(),
}))

const pages = GUIDES.killer_inspector
const stack = (page: number, onTurn?: (page: number) => void) => (
  <PaperStack mode="killer_inspector" pages={pages} page={page} onTurn={onTurn} />
)
const motion = (allowed: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: allowed && query.includes('no-preference'),
  }))
const copies = () => document.querySelectorAll('.paper[aria-hidden="true"]')

beforeEach(() => vi.mocked(play).mockClear())
afterEach(() => vi.useRealTimers())

describe('PaperStack', () => {
  it('rustles open, and shows the edges of the sheets still to read', () => {
    const { rerender } = render(stack(0))
    expect(play).toHaveBeenCalledWith('folder')
    expect(screen.getByRole('heading', { name: 'Two hunters in one crowd' })).toBeInTheDocument()
    expect(document.querySelectorAll('.paper-stack__edge')).toHaveLength(3)
    rerender(stack(7))
    expect(document.querySelectorAll('.paper-stack__edge')).toHaveLength(1)
    rerender(stack(8))
    expect(document.querySelectorAll('.paper-stack__edge')).toHaveLength(0)
  })

  it('lifts the top sheet away when turning forward, then tidies up', () => {
    vi.useFakeTimers()
    motion(true)
    const { container, rerender } = render(stack(0))
    rerender(stack(1))
    expect(play).toHaveBeenLastCalledWith('pageTurn')
    expect(container.firstChild).toHaveAttribute('data-turning', 'forward')
    const leaving = copies()
    expect(leaving).toHaveLength(1)
    expect(leaving[0]).toHaveClass('paper--leaving')
    expect(leaving[0]).toHaveTextContent('Two hunters in one crowd')
    expect(screen.getByRole('heading', { name: 'Your secret' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(800))
    expect(copies()).toHaveLength(0)
    expect(container.firstChild).not.toHaveAttribute('data-turning')
  })

  it('brings the last sheet back down over the open one when turning back', () => {
    vi.useFakeTimers()
    motion(true)
    const { container, rerender } = render(stack(2))
    rerender(stack(1))
    expect(play).toHaveBeenLastCalledWith('pageBack')
    expect(container.firstChild).toHaveAttribute('data-turning', 'back')
    expect(copies()[0]).toHaveClass('paper--under')
    expect(copies()[0]).toHaveTextContent('The first round')
    expect(container.querySelector('.paper--returning')).toHaveTextContent('Your secret')
    rerender(stack(0)) // a quick second turn replaces the first
    act(() => vi.advanceTimersByTime(800))
    expect(copies()).toHaveLength(0)
  })

  it('turns without movement for people who prefer less, but still with the sound', () => {
    motion(false)
    const { container, rerender } = render(stack(0))
    rerender(stack(1))
    expect(play).toHaveBeenLastCalledWith('pageTurn')
    expect(copies()).toHaveLength(0)
    expect(container.firstChild).not.toHaveAttribute('data-turning')
  })

  it('turns by swiping sideways or with the arrow keys, within the pages', () => {
    const onTurn = vi.fn()
    const { container, rerender } = render(stack(0, onTurn))
    const sheets = container.firstChild as HTMLElement
    const swipe = (fromX: number, toX: number, toY = 100) => {
      fireEvent.pointerDown(sheets, { clientX: fromX, clientY: 100 })
      fireEvent.pointerUp(sheets, { clientX: toX, clientY: toY })
    }
    swipe(300, 100)
    expect(onTurn).toHaveBeenLastCalledWith(1)
    swipe(100, 300) // there is no page before the first
    swipe(300, 280) // too short to be a swipe
    swipe(300, 200, 400) // mostly down: a scroll
    fireEvent.pointerUp(sheets, { clientX: 0, clientY: 0 }) // no press first
    fireEvent.pointerDown(sheets, { clientX: 300, clientY: 100 })
    fireEvent.pointerCancel(sheets)
    fireEvent.pointerUp(sheets, { clientX: 0, clientY: 100 })
    expect(onTurn).toHaveBeenCalledTimes(1)
    rerender(stack(4, onTurn))
    fireEvent.keyDown(sheets, { key: 'ArrowRight' })
    fireEvent.keyDown(sheets, { key: 'PageUp' })
    fireEvent.keyDown(sheets, { key: 'ArrowLeft' })
    fireEvent.keyDown(sheets, { key: 'PageDown' })
    fireEvent.keyDown(sheets, { key: 'Home' })
    swipe(100, 300)
    expect(onTurn.mock.calls.slice(1).flat()).toEqual([5, 3, 3, 5, 3])
  })

  it('cannot be turned from the board itself', () => {
    const { container } = render(stack(0))
    expect(container.firstChild).not.toHaveAttribute('tabindex')
  })
})
