import { describe, expect, it, vi } from 'vitest'

vi.mock('../portraits/photos', () => ({
  PHOTOS: new Map([[3, '/assets/3-d4.webp']]),
  photoData: vi.fn(),
}))

const { portraitOf } = await import('./suspects')

describe('portraits with pictures', () => {
  it('shows a suspect’s picture when there is one, and draws the rest', () => {
    expect(portraitOf(3)).toBe('/assets/3-d4.webp')
    expect(portraitOf(4)?.startsWith('data:image/svg+xml,')).toBe(true)
    expect(portraitOf(999)).toBeUndefined()
  })
})
