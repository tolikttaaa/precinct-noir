import { act, fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { levelOf, setLevel, setMuted } from '../sound/levels'
import * as music from '../sound/music'
import * as sound from '../sound/sound'
import { LanguageMenu } from './LanguageMenu'
import { SoundMenu } from './SoundMenu'

const press = (key: string) => fireEvent.keyDown(document.activeElement as Element, { key })

describe('LanguageMenu', () => {
  it('shows the language in use and drops a list of every language by its own name', () => {
    render(<LanguageMenu />)
    const button = screen.getByRole('button', { name: 'Language: English' })
    expect(button).toHaveTextContent('EN')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Language' })
    expect(button).toHaveAttribute('aria-controls', menu.id)
    const english = screen.getByRole('menuitemradio', { name: 'English' })
    const russian = screen.getByRole('menuitemradio', { name: 'Русский' })
    expect(english).toHaveAttribute('aria-checked', 'true')
    expect(russian).toHaveAttribute('aria-checked', 'false')
    expect(russian).toHaveAttribute('lang', 'ru')
    expect(english).toHaveFocus() // the language in use
    fireEvent.click(russian)
    expect(i18next.language).toBe('ru')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'Язык: Русский' })).toHaveFocus()
  })

  it('moves through the list with the arrow keys, Home and End, and closes on Escape', () => {
    render(<LanguageMenu />)
    const button = screen.getByRole('button', { name: 'Language: English' })
    fireEvent.click(button)
    const [english, russian] = screen.getAllByRole('menuitemradio')
    press('ArrowDown')
    expect(russian).toHaveFocus()
    press('ArrowDown')
    expect(english).toHaveFocus()
    press('ArrowUp')
    expect(russian).toHaveFocus()
    press('ArrowUp')
    expect(english).toHaveFocus()
    press('End')
    expect(russian).toHaveFocus()
    press('Home')
    expect(english).toHaveFocus()
    press('x') // other keys do nothing
    expect(english).toHaveFocus()
    press('Escape')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button).toHaveFocus()
  })

  it('closes when a tap lands elsewhere or the focus moves on, not when the tap is inside', () => {
    render(
      <>
        <LanguageMenu />
        <button type="button">Elsewhere</button>
      </>,
    )
    const button = screen.getByRole('button', { name: 'Language: English' })
    fireEvent.click(button)
    fireEvent.pointerDown(screen.getByRole('menu'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(button)
    fireEvent.blur(screen.getByRole('menuitemradio', { name: 'English' }), {
      relatedTarget: screen.getByRole('menuitemradio', { name: 'Русский' }),
    })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.blur(screen.getByRole('menuitemradio', { name: 'English' }), { relatedTarget: null })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.blur(screen.getByRole('menuitemradio', { name: 'English' }), {
      relatedTarget: screen.getByRole('button', { name: 'Elsewhere' }),
    })
    expect(screen.queryByRole('menu')).toBeNull()
    // Pressing the button again closes it too.
    fireEvent.click(button)
    fireEvent.click(button)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('reads an unknown language as English', async () => {
    await act(() => i18next.changeLanguage('de'))
    render(<LanguageMenu />)
    expect(screen.getByRole('button', { name: /English/ })).toHaveTextContent('EN')
  })
})

describe('SoundMenu', () => {
  it('opens a slider for the effects, with a mute, and answers each move with a click', () => {
    const play = vi.spyOn(sound, 'play')
    render(<SoundMenu />)
    const button = screen.getByRole('button', { name: 'Sound' })
    fireEvent.click(button)
    const panel = screen.getByRole('group', { name: 'Sound' })
    expect(button).toHaveAttribute('aria-controls', panel.id)
    // Only the effects here: phones in a room play no music.
    expect(screen.queryByRole('slider', { name: 'Music' })).toBeNull()
    const effects = screen.getByRole('slider', { name: 'Effects' })
    expect(effects).toHaveFocus()
    expect(effects).toHaveValue('70')
    expect(effects).toHaveAttribute('aria-valuetext', '70%')
    fireEvent.change(effects, { target: { value: '40' } })
    expect(levelOf('effects')).toEqual({ level: 40, muted: false })
    expect(play).toHaveBeenCalledWith('key')
    expect(screen.getByText('40')).toBeInTheDocument()
    const mute = screen.getByRole('button', { name: 'Effects' })
    expect(mute).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(mute)
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    expect(levelOf('effects').muted).toBe(true)
    expect(effects).toHaveAttribute('aria-valuetext', 'Off')
    expect(screen.getByText('Off')).toBeInTheDocument()
    play.mockRestore()
  })

  it('adds the music on the screens that play it, keeps it playing there, and shows a silent speaker', () => {
    const stop = vi.fn()
    const start = vi.spyOn(music, 'startMusic').mockReturnValue(stop)
    const { unmount } = render(<SoundMenu music />)
    expect(start).toHaveBeenCalledTimes(1)
    const button = screen.getByRole('button', { name: 'Sound' })
    const waves = () => button.querySelectorAll('path')[1].getAttribute('d')
    expect(waves()).toMatch(/^M15\.5 9a/)
    fireEvent.click(button)
    expect(screen.getByRole('slider', { name: 'Music' })).toHaveFocus()
    act(() => setMuted('effects', true))
    expect(waves()).toMatch(/^M15\.5 9a/) // the music still plays
    act(() => setLevel('music', 0))
    expect(waves()).toBe('m15.5 9.5 5 5m0-5-5 5')
    expect(screen.getByRole('button', { name: 'Music' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Music' }))
    expect(levelOf('music')).toEqual({ level: 70, muted: false })
    fireEvent.change(screen.getByRole('slider', { name: 'Music' }), { target: { value: '90' } })
    expect(levelOf('music').level).toBe(90)
    unmount()
    expect(stop).toHaveBeenCalled()
    start.mockRestore()
  })

  it('closes on Escape, back on its button, and on a tap elsewhere', () => {
    render(<SoundMenu />)
    const button = screen.getByRole('button', { name: 'Sound' })
    fireEvent.click(button)
    press('Escape')
    expect(screen.queryByRole('group', { name: 'Sound' })).toBeNull()
    expect(button).toHaveFocus()
    fireEvent.click(button)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('group', { name: 'Sound' })).toBeNull()
  })
})
