import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const picture = 'data:image/webp;base64,UElD'

vi.mock('../portraits/photos', async () => {
  const { ROSTER } = await import('../portraits/roster')
  const { wallSuspects } = await import('../portraits/wall')
  const id = wallSuspects(ROSTER)[0].id
  let release: () => void = () => {}
  const ready = new Promise<void>((resolve) => (release = resolve))
  return {
    PHOTOS: new Map([[id, '/assets/pic.webp']]),
    photoData: vi.fn(async () => {
      await ready
      return new Map([[id, 'data:image/webp;base64,UElD']])
    }),
    release: () => release(),
  }
})

const photos = (await import('../portraits/photos')) as unknown as { release: () => void }
const { EvidenceWall } = await import('./EvidenceWall')

describe('EvidenceWall with picture portraits', () => {
  it('waits for the pictures, then shows the wall with them, once for every screen', async () => {
    const early = render(<EvidenceWall dim={false} />)
    expect(early.container.querySelector('img')).toBeNull()
    early.unmount()

    const { container } = render(<EvidenceWall dim />)
    expect(container.querySelector('img')).toBeNull()
    photos.release()
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    const wall = container.querySelector('img') as HTMLImageElement
    expect(wall).toHaveClass('wall--dim')
    const src = wall.getAttribute('src') ?? ''
    expect(decodeURIComponent(src)).toContain(`<image href="${picture}"`)

    const again = render(<EvidenceWall dim={false} />)
    expect(again.container.querySelector('img')?.getAttribute('src')).toBe(src)
  })
})
