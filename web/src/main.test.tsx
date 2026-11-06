import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./App.tsx', () => ({ default: () => 'stub app' }))

describe('main', () => {
  it('mounts the app into #root', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    await act(async () => {
      await import('./main.tsx')
    })
    expect(document.getElementById('root')).toHaveTextContent('stub app')
  })
})
