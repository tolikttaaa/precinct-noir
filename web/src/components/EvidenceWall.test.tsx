import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EvidenceWall } from './EvidenceWall'

// A wall without pictures is drawn at once; EvidenceWall.photos.test.tsx covers the one with pictures.
vi.mock('../portraits/photos', () => ({ PHOTOS: new Map(), photoData: vi.fn() }))

describe('EvidenceWall', () => {
  it('is decoration only, drawn once, and dims where text sits on it', () => {
    const { container, rerender } = render(<EvidenceWall dim={false} />)
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('aria-hidden', 'true')
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveClass('wall')
    expect(img).not.toHaveClass('wall--dim')
    const src = img.getAttribute('src')
    expect(src?.startsWith('data:image/svg+xml,')).toBe(true)
    rerender(<EvidenceWall dim />)
    expect(container.querySelector('img')).toHaveClass('wall--dim')
    expect(container.querySelector('img')!.getAttribute('src')).toBe(src)
  })
})
