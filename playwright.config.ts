import { defineConfig } from '@playwright/test'

/**
 * Electron end-to-end tests. Run `npm run build` first; `npm run test:e2e` strips
 * ELECTRON_RUN_AS_NODE via scripts/with-electron-env.mjs so Electron starts as Electron.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: 'list',
  outputDir: 'test-results',
  expect: { timeout: 10_000 }
})
