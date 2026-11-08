import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { soundOn } from '../sound/sound'
import { SoundSwitch } from './SoundSwitch'

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
