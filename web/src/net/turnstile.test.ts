import { describe, expect, it, vi } from 'vitest'
import { humanToken, loadTurnstile, TurnstileError, type TurnstileApi } from './turnstile'

function fakeTurnstile(answer: 'pass' | 'fail') {
  const api: TurnstileApi = {
    render: vi.fn((_container, options) => {
      queueMicrotask(() =>
        answer === 'pass' ? options.callback('token-1') : options['error-callback'](),
      )
      return 'widget-1'
    }),
    remove: vi.fn(),
  }
  return api
}

const script = () =>
  document.head.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]')

describe('Turnstile', () => {
  it('loads its script once, then hands out the API', async () => {
    const loading = loadTurnstile()
    expect(loadTurnstile()).toBe(loading)
    expect(script()?.src).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    )
    const api = fakeTurnstile('pass')
    window.turnstile = api
    script()!.onload!(new Event('load'))
    await expect(loading).resolves.toBe(api)
    await expect(loadTurnstile()).resolves.toBe(api)
    script()!.remove()
  })

  it('fails when the script does not load, and can try again', async () => {
    const first = loadTurnstile()
    script()!.onerror!(new Event('error'))
    await expect(first).rejects.toBeInstanceOf(TurnstileError)
    expect(script()).toBeNull()
    const second = loadTurnstile()
    expect(second).not.toBe(first)
    script()!.onload!(new Event('load')) // loaded, but no API showed up
    await expect(second).rejects.toBeInstanceOf(TurnstileError)
    script()!.remove()
  })

  it('runs the check and returns a single-use token', async () => {
    const api = fakeTurnstile('pass')
    window.turnstile = api
    const container = document.createElement('div')
    await expect(humanToken('site-key', container)).resolves.toBe('token-1')
    expect(api.render).toHaveBeenCalledWith(
      container,
      expect.objectContaining({ sitekey: 'site-key' }),
    )
    expect(api.remove).toHaveBeenCalledWith('widget-1')
  })

  it('reports a failed check', async () => {
    const api = fakeTurnstile('fail')
    window.turnstile = api
    await expect(humanToken('site-key', document.createElement('div'))).rejects.toBeInstanceOf(
      TurnstileError,
    )
    expect(api.remove).toHaveBeenCalledWith('widget-1')
  })
})
