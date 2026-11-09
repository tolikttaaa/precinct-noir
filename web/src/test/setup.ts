import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetConfigForTests } from '../hooks/useConfig'
import { resetModesForTests } from '../hooks/useModes'
import { initI18n } from '../i18n'
import { resetTurnstileForTests } from '../net/turnstile'
import { resetMusicForTests } from '../sound/music'
import { FakeWebSocket } from './fakeWebSocket'

initI18n('en')

// jsdom doesn't scroll; tests check that the app asked to.
window.scrollTo = vi.fn() as typeof window.scrollTo

beforeEach(() => {
  vi.mocked(window.scrollTo).mockClear()
  FakeWebSocket.reset()
  window.history.replaceState(null, '', '/')
})

// Testing Library only auto-cleans when Vitest globals are enabled; unmount explicitly after each test.
afterEach(async () => {
  cleanup()
  localStorage.clear()
  resetModesForTests()
  resetConfigForTests()
  resetTurnstileForTests()
  resetMusicForTests()
  delete window.turnstile
  await i18next.changeLanguage('en')
})
