import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { GamePicker } from './GamePicker'

const SOME = new Set(['killer_inspector', 'spy_games', 'heist'])

function Picker({ offered = SOME, start = 'killer_inspector', onChange = vi.fn() }) {
  const [value, setValue] = useState(start)
  return (
    <GamePicker
      offered={offered}
      value={value}
      onChange={(mode) => {
        onChange(mode)
        setValue(mode)
      }}
    />
  )
}

const field = () => screen.getByRole('combobox', { name: 'Game' })
const key = (k: string) => fireEvent.keyDown(field(), { key: k })
const active = () => document.getElementById(field().getAttribute('aria-activedescendant')!)

function at(rect: Partial<DOMRect>) {
  vi.spyOn(field(), 'getBoundingClientRect').mockReturnValue({
    left: 20,
    width: 300,
    top: 0,
    bottom: 0,
    ...rect,
  } as DOMRect)
}

describe('GamePicker', () => {
  it('shows the chosen game, its player count and what it is', () => {
    render(<Picker />)
    expect(field()).toHaveTextContent('Shadow Duel2 players')
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    expect(field()).toHaveAccessibleDescription(
      'Two players. One is a killer hiding among the suspects; the other is the inspector hunting them.',
    )
  })

  it('falls back to the player count for a game with no summary yet', () => {
    render(<Picker start="spy_games" />)
    expect(field()).toHaveAccessibleDescription('3–6, 8 or 9 players')
  })

  it('lists every game on its card, the ones still to come stamped and out of reach', () => {
    const onChange = vi.fn()
    render(<Picker offered={new Set(['killer_inspector'])} onChange={onChange} />)
    fireEvent.click(field())
    expect(field()).toHaveAttribute('aria-expanded', 'true')
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual([
      'Shadow Duel, 2 players',
      'Spy Ring, Coming later, 3–6, 8 or 9 players',
      'The Hit List, Coming later, 2 players',
      'Cat Burglar, Coming later, 2 players',
      'Feds vs. Mob, Coming later, 6 or 8 players',
      'Casino Heist, Coming later, 5–7 players',
    ])
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options.slice(1).every((o) => o.getAttribute('aria-disabled') === 'true')).toBe(true)
    expect(screen.getAllByText('Coming later')).toHaveLength(5)
    // A game that's still to come can't be picked, by click or by hovering onto it.
    fireEvent.mouseEnter(options[3])
    expect(active()).toBe(options[0])
    fireEvent.click(options[3])
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    // The field keeps the focus while the card is pressed, so it doesn't close first.
    expect(fireEvent.mouseDown(options[0])).toBe(false)
    // A second click on the field puts the card away.
    fireEvent.click(field())
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('picks a game with the mouse', () => {
    const onChange = vi.fn()
    render(<Picker onChange={onChange} />)
    fireEvent.click(field())
    const spy = screen.getByRole('option', { name: 'Spy Ring, 3–6, 8 or 9 players' })
    fireEvent.mouseEnter(spy)
    expect(active()).toBe(spy)
    fireEvent.click(spy)
    expect(onChange).toHaveBeenCalledWith('spy_games')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(field()).toHaveTextContent('Spy Ring')
  })

  it('works from the keyboard like a select, skipping the games still to come', () => {
    const onChange = vi.fn()
    render(<Picker onChange={onChange} />)
    key('a') // not a key it uses
    expect(screen.queryByRole('listbox')).toBeNull()
    key('ArrowDown')
    expect(active()).toHaveAccessibleName('Shadow Duel, 2 players')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    key('ArrowDown')
    expect(active()).toHaveAccessibleName('Spy Ring, 3–6, 8 or 9 players')
    key('ArrowDown') // over the three still to come
    expect(active()).toHaveAccessibleName('Casino Heist, 5–7 players')
    key('ArrowDown') // the last one stays
    expect(active()).toHaveAccessibleName('Casino Heist, 5–7 players')
    key('ArrowUp')
    expect(active()).toHaveAccessibleName('Spy Ring, 3–6, 8 or 9 players')
    key('Home')
    expect(active()).toHaveAccessibleName('Shadow Duel, 2 players')
    key('ArrowUp') // the first one stays
    expect(active()).toHaveAccessibleName('Shadow Duel, 2 players')
    key('End')
    expect(active()).toHaveAccessibleName('Casino Heist, 5–7 players')
    key('x') // ignored while open too
    key('Enter')
    expect(onChange).toHaveBeenLastCalledWith('heist')
    expect(screen.queryByRole('listbox')).toBeNull()

    key(' ')
    expect(active()).toHaveAccessibleName('Casino Heist, 5–7 players')
    key('Escape')
    expect(screen.queryByRole('listbox')).toBeNull()
    key('Home')
    expect(active()).toHaveAccessibleName('Shadow Duel, 2 players')
    key(' ')
    expect(onChange).toHaveBeenLastCalledWith('killer_inspector')
    key('End')
    expect(active()).toHaveAccessibleName('Casino Heist, 5–7 players')
    key('ArrowUp')
    key('Tab') // takes the highlighted game and moves on
    expect(onChange).toHaveBeenLastCalledWith('spy_games')
    expect(screen.queryByRole('listbox')).toBeNull()
    key('ArrowUp')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.blur(field())
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes when someone presses elsewhere', () => {
    render(<Picker />)
    fireEvent.click(field())
    fireEvent.pointerDown(screen.getByRole('option', { name: 'Shadow Duel, 2 players' }))
    fireEvent.pointerDown(field())
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens where the whole card fits, or on the roomier side, and follows the page', () => {
    vi.stubGlobal('innerHeight', 800)
    const tall = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(380)
    render(<Picker />)
    at({ top: 100, bottom: 152 }) // 630 px free below
    fireEvent.click(field())
    const card = screen.getByRole('listbox')
    expect(card.style).toMatchObject({
      left: '20px',
      width: '300px',
      top: '158px',
      maxHeight: '630px',
    })
    const move = (rect: Partial<DOMRect>, event = 'resize') => {
      at(rect)
      act(() => void window.dispatchEvent(new Event(event)))
    }
    move({ top: 600, bottom: 652 }) // 130 below, 582 above: over the field
    expect(card.style).toMatchObject({ bottom: '206px', maxHeight: '582px', top: '' })
    move({ top: 300, bottom: 352 }, 'scroll') // 430 below: under it again
    expect(card.style).toMatchObject({ top: '358px', maxHeight: '430px' })
    tall.mockReturnValue(600)
    fireEvent.click(field())
    at({ top: 250, bottom: 302 }) // fits nowhere: 480 below beats 232 above
    fireEvent.click(field())
    expect(screen.getByRole('listbox').style).toMatchObject({ top: '308px', maxHeight: '480px' })
    move({ top: 500, bottom: 552 }) // fits nowhere: 482 above beats 230 below
    expect(screen.getByRole('listbox').style).toMatchObject({ bottom: '306px', maxHeight: '482px' })
    tall.mockRestore()
    vi.unstubAllGlobals()
  })

  it("can't be opened before the server has listed its games, or while a room is opening", () => {
    const { rerender } = render(<GamePicker onChange={vi.fn()} />)
    expect(field()).toHaveAttribute('aria-disabled', 'true')
    expect(field()).toHaveTextContent('Shadow Duel')
    fireEvent.click(field())
    key('ArrowDown')
    expect(screen.queryByRole('listbox')).toBeNull()
    rerender(<GamePicker offered={SOME} value="heist" onChange={vi.fn()} disabled />)
    fireEvent.click(field())
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
