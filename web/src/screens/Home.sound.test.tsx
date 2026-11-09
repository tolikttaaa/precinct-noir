import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { play } from '../sound/sound'
import { stubFetch } from '../test/fixtures'
import { Home } from './Home'

vi.mock('../sound/sound', async (actual) => ({
  ...(await actual<typeof import('../sound/sound')>()),
  play: vi.fn(),
}))

describe('Home sounds', () => {
  it('types each key of the code and stamps the choices', () => {
    stubFetch({})
    render(<Home />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Room code' }), {
      target: { value: 'B' },
    })
    expect(play).toHaveBeenLastCalledWith('key')
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(play).toHaveBeenLastCalledWith('stamp')
    vi.mocked(play).mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    expect(play).toHaveBeenCalledWith('stamp')
  })
})
