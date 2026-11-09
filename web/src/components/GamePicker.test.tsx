import { act, fireEvent, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
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

const field = () => screen.getByRole('button', { name: /^Game / })
const page = () => screen.getByRole('dialog', { name: 'Choose a game' })
const entry = (name: string) => screen.getByRole('heading', { name }).closest('li')!

describe('GamePicker', () => {
  it('shows the chosen game in the folder, with what it is', () => {
    render(<Picker />)
    expect(field()).toHaveAccessibleName('Game Shadow Duel')
    expect(field()).toHaveTextContent('Shadow Duel2 playersAll games')
    expect(field()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(field()).toHaveAccessibleDescription(
      'Two players. One is a killer hiding among the suspects; the other is the inspector hunting them.',
    )
  })

  it('pulls out a top-secret page with every game, the ones still to come stamped', () => {
    render(<Picker offered={new Set(['killer_inspector'])} />)
    fireEvent.click(field())
    expect(page()).toHaveAttribute('aria-modal', 'true')
    expect(page()).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    expect(screen.getByText('Top secret')).toBeInTheDocument()
    const names = within(page())
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(names).toEqual([
      'Shadow Duel',
      'Spy Ring',
      'The Hit List',
      'Cat Burglar',
      'Feds vs. Mob',
      'Casino Heist',
    ])
    expect(within(entry('Shadow Duel')).getByText('Chosen')).toBeInTheDocument()
    for (const later of [
      'Spy Ring',
      'The Hit List',
      'Cat Burglar',
      'Feds vs. Mob',
      'Casino Heist',
    ]) {
      expect(within(entry(later)).getByText('Coming later')).toBeInTheDocument()
      expect(within(entry(later)).queryByRole('button')).toBeNull()
    }
    expect(
      within(entry('Feds vs. Mob')).getByText(/^Six or eight players in two teams/),
    ).toBeVisible()
  })

  it('chooses another game and puts the page back', () => {
    const onChange = vi.fn()
    render(<Picker onChange={onChange} />)
    fireEvent.click(field())
    fireEvent.click(screen.getByRole('button', { name: 'Choose Spy Ring' }))
    expect(onChange).toHaveBeenCalledWith('spy_games')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(field()).toHaveAccessibleName('Game Spy Ring')
    expect(field()).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
    expect(field()).toHaveAccessibleDescription(/^Three to nine players/)
  })

  it('has a second Close at its end only when it is taller than the screen', () => {
    render(<Picker />)
    fireEvent.click(field())
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1)
    const tall = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(2000)
    act(() => void window.dispatchEvent(new Event('resize'))) // turned to a shorter screen
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2)
    tall.mockRestore()
    act(() => void window.dispatchEvent(new Event('resize')))
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1)
  })

  it('goes back into the folder with Close, Escape or a press beside the page', () => {
    const onChange = vi.fn()
    const tall = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(2000)
    render(<Picker onChange={onChange} />)
    for (const putBack of [
      () => fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]),
      () => fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]),
      () => fireEvent.keyDown(page(), { key: 'Escape' }),
      () => fireEvent.mouseDown(page().parentElement!),
    ]) {
      fireEvent.click(field())
      fireEvent.mouseDown(page()) // a press on the page itself keeps it out
      fireEvent.keyDown(page(), { key: 'a' })
      expect(page()).toBeInTheDocument()
      putBack()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(field()).toHaveFocus()
    }
    expect(onChange).not.toHaveBeenCalled()
    tall.mockRestore()
  })

  it('keeps the focus on the page while it is out', () => {
    render(<Picker />)
    fireEvent.click(field())
    const buttons = within(page()).getAllByRole('button')
    const [first, last] = [buttons[0], buttons[buttons.length - 1]]
    fireEvent.keyDown(page(), { key: 'Tab', shiftKey: true }) // from the page itself
    expect(last).toHaveFocus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    buttons[1].focus()
    expect(fireEvent.keyDown(buttons[1], { key: 'Tab' })).toBe(true) // the browser moves on
    expect(fireEvent.keyDown(buttons[1], { key: 'Tab', shiftKey: true })).toBe(true)
  })

  it('reads in Russian too', async () => {
    render(<Picker />)
    await act(() => i18next.changeLanguage('ru'))
    fireEvent.click(screen.getByRole('button', { name: /^Игра / }))
    expect(screen.getByRole('dialog', { name: 'Выберите игру' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Выбрать: Шпионская сеть' })).toBeInTheDocument()
    expect(screen.getAllByText('Появится позже')).toHaveLength(3)
  })

  it("can't be opened before the server has listed its games, or while a room is opening", () => {
    const { rerender } = render(<GamePicker onChange={vi.fn()} />)
    expect(field()).toBeDisabled()
    expect(field()).toHaveAccessibleName('Game Shadow Duel')
    rerender(<GamePicker offered={SOME} value="heist" onChange={vi.fn()} disabled />)
    expect(field()).toBeDisabled()
  })
})
