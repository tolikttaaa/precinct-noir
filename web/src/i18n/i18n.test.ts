import i18next from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../net/api'
import { TurnstileError } from '../net/turnstile'
import en from './en'
import { initI18n, preferredLanguage, setLanguage } from './index'
import ru from './ru'
import { errorText, modeName, modeSummary, optionText } from './text'

/** All leaf keys, with plural forms and the f/m forms Russian needs for a suspect's gender folded into their base key. */
function keys(messages: object, prefix = ''): Set<string> {
  const out = new Set<string>()
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix + key.replace(/_(zero|one|few|many|other|f|m)$/, '')
    if (typeof value === 'string') out.add(path)
    else keys(value as object, `${path}.`).forEach((k) => out.add(k))
  }
  return out
}

describe('texts', () => {
  it('exist in both languages', () => {
    expect([...keys(ru)].sort()).toEqual([...keys(en)].sort())
  })

  it('use Russian plural forms', async () => {
    await i18next.changeLanguage('ru')
    const t = i18next.t
    expect([0, 1, 3, 5, 21].map((count) => t('join.waiting', { count }))).toEqual([
      'Пока никто не вошёл',
      'Ждёт 1 игрок',
      'Ждут 3 игрока',
      'Ждут 5 игроков',
      'Ждёт 21 игрок',
    ])
  })
})

describe('language choice', () => {
  it('prefers a saved choice, then the browser, then English', () => {
    const languages = vi.spyOn(navigator, 'languages', 'get')
    languages.mockReturnValue(['de-DE', 'ru-RU'])
    expect(preferredLanguage()).toBe('ru')
    languages.mockReturnValue(['de-DE'])
    expect(preferredLanguage()).toBe('en')
    localStorage.setItem('precinctnoir.language', 'ru')
    expect(preferredLanguage()).toBe('ru')
    localStorage.setItem('precinctnoir.language', 'fr')
    expect(preferredLanguage()).toBe('en')
  })

  it('switches the page language and remembers it, storage permitting', () => {
    setLanguage('ru')
    expect([i18next.language, document.documentElement.lang]).toEqual(['ru', 'ru'])
    expect(localStorage.getItem('precinctnoir.language')).toBe('ru')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => setLanguage('en')).not.toThrow()
    expect(preferredLanguage()).toBe('en')
    expect(initI18n().language).toBe('en')
  })
})

describe('text helpers', () => {
  const t = i18next.t

  it('name modes and their rules, falling back to ids', () => {
    expect(modeName(t, 'killer_inspector')).toBe('Shadow Duel')
    expect(modeName(t, 'future_mode')).toBe('future_mode')
    expect(modeSummary(t, 'future_mode')).toBe('')
    expect(optionText(t, 'killer_inspector', 'interrogateDeadOnBoard', 'label')).toBe(
      'Clues from the dead',
    )
    expect(optionText(t, 'future_mode', 'speed', 'label')).toBe('speed')
    expect(optionText(t, 'future_mode', 'speed', 'hint')).toBe('')
  })

  it('explain failures', () => {
    expect(errorText(t, new TurnstileError())).toMatch(/bot check couldn't run/)
    expect(errorText(t, new ApiError(404, 'room_not_found'), 'BKTR')).toBe(
      'No room has the code BKTR. Check the code on the board.',
    )
    expect(errorText(t, new ApiError(429, 'rate_limited', 90))).toBe(
      'Too many tries from this network. Try again in 2 min.',
    )
    expect(errorText(t, new ApiError(429, 'rate_limited'))).toMatch(/in 1 min/)
    expect(errorText(t, new ApiError(418, 'teapot'))).toBe('Something went wrong. Try again.')
    expect(errorText(t, new Error('boom'))).toBe('Something went wrong. Try again.')
  })
})
