/// <reference types="vitest/config" />
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// Spring Boot backend during local development (`./gradlew :server:bootRun`).
const backend = 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  // The React Compiler only memoizes. Tests run the plain components, so coverage counts our branches
  // rather than the compiler's cache checks; the production build (and M5's E2E tests) run compiled.
  plugins: [react(), ...(process.env.VITEST ? [] : [babel({ presets: [reactCompilerPreset()] })])],
  build: {
    // Emit every asset as a file: inlined data: URIs (small font subsets) would break the CSP's font-src 'self'.
    assetsInlineLimit: 0,
  },
  server: {
    // The roster lives in shared/ at the repository root, next to the engine that uses the same ids.
    fs: { allow: ['..'] },
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
      // generated.ts holds types only (no runtime code).
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/protocol/generated.ts'],
      reporter: ['text', 'html', 'lcov'],
      // The goal is ~100%; these floors stop regressions (see docs/ARCHITECTURE.md → Verification).
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
    },
  },
})
