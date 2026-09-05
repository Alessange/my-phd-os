import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

export interface LaunchedApp {
  app: ElectronApplication
  window: Page
  userDataDir: string
  /** `console.error` lines and uncaught page errors seen in the renderer. */
  consoleErrors: string[]
  pageErrors: Error[]
  close(): Promise<void>
}

/**
 * Launches the built app (`out/`) with a fresh temporary `userData` and E2E mode enabled.
 * Requires `npm run build` first. Never touches the real user data directory.
 */
export const launchApp = async (): Promise<LaunchedApp> => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'my-phd-os-e2e-'))
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') env[key] = value
  }
  env.MY_PHD_OS_USER_DATA = userDataDir
  env.MY_PHD_OS_E2E = '1'
  delete env.ELECTRON_RENDERER_URL
  delete env.NODE_ENV

  const app = await electron.launch({ args: [resolve('.')], env, cwd: resolve('.') })
  const consoleErrors: string[] = []
  const pageErrors: Error[] = []
  const window = await app.firstWindow()
  window.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  window.on('pageerror', (error) => pageErrors.push(error))
  await window.waitForLoadState('domcontentloaded')

  return {
    app,
    window,
    userDataDir,
    consoleErrors,
    pageErrors,
    close: async () => {
      await app.close()
      rmSync(userDataDir, { recursive: true, force: true })
    }
  }
}
