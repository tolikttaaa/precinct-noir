import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { json, stubFetch } from '../test/fixtures'
import { Version } from './Version'

describe('Version', () => {
  it('names the release and its commit', async () => {
    stubFetch({
      'GET /api/config': () =>
        json(200, { version: '0.1.0', commit: '1e96502a0b1c2d3e4f5061728394a5b6c7d8e9f0' }),
    })
    render(<Version />)
    expect(await screen.findByText('Version 0.1.0 · 1e96502')).toBeInTheDocument()
    await act(() => i18next.changeLanguage('ru'))
    expect(screen.getByText('Версия 0.1.0 · 1e96502')).toBeInTheDocument()
  })

  it('calls a build between releases a development build', async () => {
    stubFetch({ 'GET /api/config': () => json(200, {}) })
    render(<Version />)
    expect(await screen.findByText('Development build')).toBeInTheDocument()
  })

  it('stays blank when the server cannot be reached, and asks again next time', async () => {
    const fetchMock = stubFetch({ 'GET /api/config': () => json(503, { error: 'unexpected' }) })
    const { container, unmount } = render(<Version />)
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
    unmount()
    render(<Version />)
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
