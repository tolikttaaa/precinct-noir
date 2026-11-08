import { defineConfig } from '@playwright/test'

/**
 * One long test: a living-room session on a TV and two phones. It runs against a real server, by default the
 * production image started by `npm run stack:up` (compose.yaml) on http://localhost:8080.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 8 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    // Locally, `E2E_CHANNEL=chrome` uses the installed Chrome instead of a downloaded browser.
    channel: process.env.E2E_CHANNEL || undefined,
    actionTimeout: 15_000,
  },
})
