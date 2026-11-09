import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { musicOn } from '../sound/music'
import { setSoundOn, soundOn } from '../sound/sound'
import { MusicSwitch, SoundSwitch } from './SoundSwitch'

describe('SoundSwitch', () => {
  it('switches this device’s sound off and on again', () => {
    render(<SoundSwitch />)
    const button = screen.getByRole('button', { name: 'Sound' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(soundOn()).toBe(false)
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('MusicSwitch', () => {
  it('switches the music off and on, and switching it on turns sound on too', () => {
    render(<MusicSwitch />)
    const button = screen.getByRole('button', { name: 'Music' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(musicOn()).toBe(false)
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    // With sound off the music is silent, and says so; switching it on brings sound back.
    act(() => setSoundOn(false))
    expect(button).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button)
    expect(soundOn()).toBe(true)
    expect(musicOn()).toBe(true)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})
