import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TileView } from '../protocol/generated'
import { duelView, tile } from '../test/fixtures'
import { Board } from './Board'

const tiles = duelView().board.tiles

describe('Board', () => {
  it('shows every suspect with their marks', () => {
    const marked = tiles.map((t) =>
      t.id === 2 ? tile(2, { alive: false }) : t.id === 3 ? tile(3, { exonerated: true }) : t,
    )
    render(<Board size="tv" rows={5} cols={5} tiles={marked} />)
    const city = screen.getByRole('group', { name: 'The city' })
    expect(city.querySelectorAll('.suspect-card')).toHaveLength(25)
    expect(screen.getByRole('img', { name: 'Beatrice, dead' })).toBeInTheDocument()
    const cleared = screen.getByRole('img', { name: 'Bruno, cleared' })
    expect(cleared).toHaveTextContent('Cleared')
    const stamp = cleared.querySelector('.suspect-card__cleared') as HTMLElement
    expect(stamp.style.getPropertyValue('--chars')).toBe('7')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('gives each name its length, so a long name shrinks to fit instead of being cut off', () => {
    render(<Board size="tv" rows={5} cols={5} tiles={tiles} />)
    const name = screen.getByRole('img', { name: 'Beatrice' }).querySelector('.suspect-card__name')
    expect(name).toHaveTextContent('Beatrice')
    expect((name as HTMLElement).style.getPropertyValue('--chars')).toBe('8')
  })

  it('lets only lit suspects be picked, and marks the chosen one and your own', () => {
    const onTile = vi.fn()
    render(
      <Board
        size="phone"
        rows={5}
        cols={5}
        tiles={tiles}
        lit={new Set([1, 5])}
        chosen={new Set([5])}
        mine={12}
        onTile={onTile}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Calvin' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Abe' }))
    expect(onTile).toHaveBeenCalledWith(1)
    expect(screen.getByRole('img', { name: 'Gloria, you' })).toBeInTheDocument()
  })

  it('numbers rows and columns on the TV and marks the line that moved last', () => {
    render(
      <Board
        size="tv"
        rows={5}
        cols={5}
        tiles={tiles}
        labels
        lastShift={{ line: { axis: 'col', index: 2 }, by: 1, length: 5 }}
      />,
    )
    const labels = document.querySelectorAll('.board__label')
    expect(labels).toHaveLength(10)
    expect(
      [...labels].filter((l) => l.hasAttribute('data-last')).map((l) => l.textContent),
    ).toEqual(['3'])
  })

  it('puts shift arrows on every edge, enabled where the shift is legal', () => {
    const onShift = vi.fn()
    render(
      <Board
        size="phone"
        rows={5}
        cols={5}
        tiles={tiles}
        shift={{
          can: (line, by) => line.axis === 'row' && by === 1,
          onShift,
          chosen: { line: { axis: 'row', index: 1 }, by: 1 },
        }}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(20)
    expect(screen.getByRole('button', { name: 'Shift column 1 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Shift column 5 down' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Shift row 3 left' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Shift row 2 right' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Shift row 4 right' }))
    expect(onShift).toHaveBeenCalledWith({ axis: 'row', index: 3 }, 1)
  })
})

describe('Board motion', () => {
  const animate = vi.fn()
  // jsdom has no layout: place each card by its order in the grid, 100×120 per cell.
  function layOut() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const i = [...(this.parentElement?.children ?? [])].indexOf(this)
      return {
        left: (i % 5) * 100,
        top: Math.floor(i / 5) * 120,
        width: 100,
        height: 120,
      } as DOMRect
    })
    HTMLElement.prototype.animate = animate
  }
  const shifted = (row: readonly TileView[]) => [row[4], ...row.slice(0, 4)] // row 1 one step right

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate
    animate.mockReset()
  })

  it('glides moved cards, sliding the wrapped one in from the edge', () => {
    layOut()
    const { rerender } = render(<Board size="tv" rows={5} cols={5} tiles={tiles} />)
    expect(animate).not.toHaveBeenCalled()
    rerender(
      <Board
        size="tv"
        rows={5}
        cols={5}
        tiles={[...shifted(tiles.slice(0, 5)), ...tiles.slice(5)]}
      />,
    )
    expect(animate).toHaveBeenCalledTimes(5)
    const frames = animate.mock.calls.map(([keyframes]) => keyframes[0])
    expect(frames).toContainEqual({ transform: 'translate(-100px, 0px)' })
    expect(frames).toContainEqual({ transform: 'translate(-100px, 0px)', opacity: 0 })
  })

  it('stays still for people who prefer less motion', () => {
    layOut()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { rerender } = render(<Board size="tv" rows={5} cols={5} tiles={tiles} />)
    rerender(
      <Board
        size="tv"
        rows={5}
        cols={5}
        tiles={[...shifted(tiles.slice(0, 5)), ...tiles.slice(5)]}
      />,
    )
    expect(animate).not.toHaveBeenCalled()
  })
})
