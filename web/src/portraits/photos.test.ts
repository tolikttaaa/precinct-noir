import { afterEach, describe, expect, it, vi } from 'vitest'
import { PHOTOS, photoData, photoIndex } from './photos'

describe('picture portraits', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds pictures named by suspect id and ignores other files', () => {
    const index = photoIndex({
      './images/0.webp': '/assets/0-a1.webp',
      './images/12.jpg': '/assets/12-b2.jpg',
      './images/59.png': '/assets/59-c3.png',
      './images/ada.webp': '/assets/ada.webp',
      './images/7-old.png': '/assets/7-old.png',
    })
    expect([...index]).toEqual([
      [0, '/assets/0-a1.webp'],
      [12, '/assets/12-b2.jpg'],
      [59, '/assets/59-c3.png'],
    ])
    expect(PHOTOS).toBeInstanceOf(Map)
  })

  it('fetches pictures as data URIs, leaving out any that fail', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url === '/missing.webp') return new Response(null, { status: 404 })
      if (url === '/offline.webp') throw new TypeError('Failed to fetch')
      return new Response('pic', { headers: { 'Content-Type': 'image/webp' } })
    })
    vi.stubGlobal('fetch', fetch)
    const photos = new Map([
      [1, '/1.webp'],
      [2, '/missing.webp'],
      [3, '/offline.webp'],
    ])
    const data = await photoData(photos, [1, 2, 3, 4])
    expect([...data.keys()]).toEqual([1])
    expect(data.get(1)).toBe(`data:image/webp;base64,${btoa('pic')}`)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('leaves out a picture the browser cannot read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['pic']))),
    )
    class BrokenReader {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      error = null
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('FileReader', BrokenReader)
    expect((await photoData(new Map([[1, '/1.webp']]), [1])).size).toBe(0)
  })
})
