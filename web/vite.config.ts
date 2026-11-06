/// <reference types="vitest/config" />
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// Spring Boot backend during local development (`./gradlew :server:bootRun`).
const backend = 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  server: {
    proxy: {
      '/api': backend,
      '/actuator': backend,
      '/ws': { target: backend, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      reporter: ['text', 'html', 'lcov'],
      // The goal is ~100%; these floors stop regressions (see docs/ARCHITECTURE.md → Verification).
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
    },
  },
})
