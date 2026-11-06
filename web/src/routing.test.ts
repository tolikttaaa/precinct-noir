import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { navigate, normalizeCode, parseRoute, usePath } from './routing'

describe('routing', () => {
  it('maps paths to screens', () => {
    expect(parseRoute('/')).toEqual({ page: 'home' })
    expect(parseRoute('/bktr')).toEqual({ page: 'player', code: 'BKTR' })
    expect(parseRoute('/tv/BKTR/')).toEqual({ page: 'tv', code: 'BKTR' })
    for (const path of ['/ABCD', '/tv', '/tv/AB', '/x/BKTR', '/BKTR/extra', '/tv/BKTR/x']) {
      expect(parseRoute(path)).toEqual({ page: 'missing' })
    }
  })

  it('accepts room codes the way people type them', () => {
    expect(normalizeCode(' bktr ')).toBe('BKTR')
    expect(normalizeCode('BKT')).toBeNull()
    expect(normalizeCode('BAKT')).toBeNull() // no vowels in codes
  })

  it('navigates without reloading and re-renders on the new path', () => {
    const { result } = renderHook(() => usePath())
    expect(result.current).toBe('/')
    act(() => navigate('/tv/BKTR'))
    expect(result.current).toBe('/tv/BKTR')
    act(() => window.history.back())
  })
})
