import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach } from 'vitest'
import { resetModesForTests } from '../hooks/useModes'
import { initI18n } from '../i18n'
import { resetTurnstileForTests } from '../net/turnstile'
import { FakeWebSocket } from './fakeWebSocket'

initI18n('en')

beforeEach(() => {
  FakeWebSocket.reset()
  window.history.replaceState(null, '', '/')
})

// Testing Library only auto-cleans when Vitest globals are enabled; unmount explicitly after each test.
afterEach(async () => {
  cleanup()
  localStorage.clear()
  resetModesForTests()
  resetTurnstileForTests()
  delete window.turnstile
  await i18next.changeLanguage('en')
})
