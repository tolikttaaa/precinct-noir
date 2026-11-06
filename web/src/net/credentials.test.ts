import { describe, expect, it, vi } from 'vitest'
import { forgetCredentials, loadCredentials, saveCredentials } from './credentials'

describe('credentials', () => {
  it('are kept per room and per role', () => {
    saveCredentials('BKTR', 'player', { token: 'p', playerId: 2, clientSeq: 7 })
    saveCredentials('BKTR', 'host', { token: 'h', clientSeq: 0 })
    expect(loadCredentials('BKTR', 'player')).toEqual({ token: 'p', playerId: 2, clientSeq: 7 })
    expect(loadCredentials('BKTR', 'host')).toEqual({
      token: 'h',
      playerId: undefined,
      clientSeq: 0,
    })
    expect(loadCredentials('CDFG', 'player')).toBeNull()
    forgetCredentials('BKTR', 'player')
    expect(loadCredentials('BKTR', 'player')).toBeNull()
  })

  it('ignore anything malformed', () => {
    localStorage.setItem('precinctnoir.BKTR.player', '{broken')
    expect(loadCredentials('BKTR', 'player')).toBeNull()
    localStorage.setItem('precinctnoir.BKTR.player', '{"token":5}')
    expect(loadCredentials('BKTR', 'player')).toBeNull()
    localStorage.setItem('precinctnoir.BKTR.player', '{"token":"t","playerId":"2"}')
    expect(loadCredentials('BKTR', 'player')).toEqual({
      token: 't',
      playerId: undefined,
      clientSeq: 0,
    })
  })

  it('cope without storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => saveCredentials('BKTR', 'host', { token: 'h', clientSeq: 0 })).not.toThrow()
    expect(() => forgetCredentials('BKTR', 'host')).not.toThrow()
  })
})
