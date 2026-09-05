import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

export interface ConsoleLine {
  type: string
  text: string
}

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  userDataDir: string
  /** `console.error` lines seen in the renderer. */
  consoleErrors: string[]
  /** Every console message (all levels) seen in the renderer, for CSP / warning checks. */
  consoleMessages: ConsoleLine[]
  /** Uncaught page errors seen in the renderer. */
  pageErrors: Error[]
  /**
   * Quits the app. By default the temp `userData` is deleted; pass `{ keepUserData: true }` to
   * relaunch against the same directory (theme / window-state persistence tests).
   */
  close(options?: { keepUserData?: boolean }): Promise<void>
}

export interface LaunchOptions {
  /** Reuse an existing temp `userData` (from a previous `launchApp` closed with `keepUserData`). */
  userDataDir?: string
}

/** Creates a fresh temporary `userData` directory for one app instance. */
export const createTempUserData = (): string => mkdtempSync(join(tmpdir(), 'my-phd-os-e2e-'))

/**
 * Launches the built app (`out/`) with a fresh temporary `userData` and E2E mode enabled.
 * Requires `npm run build` first. Never touches the real user data directory.
 */
export const launchApp = async (options: LaunchOptions = {}): Promise<LaunchedApp> => {
  const userDataDir = options.userDataDir ?? createTempUserData()
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
  const consoleMessages: ConsoleLine[] = []
  const pageErrors: Error[] = []
  const page = await app.firstWindow()
  page.on('console', (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() })
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error))
  await page.waitForLoadState('domcontentloaded')

  return {
    app,
    page,
    userDataDir,
    consoleErrors,
    consoleMessages,
    pageErrors,
    close: async ({ keepUserData = false } = {}) => {
      await app.close()
      if (!keepUserData) rmSync(userDataDir, { recursive: true, force: true })
    }
  }
}

/** Waits until the shell has rendered (the primary navigation is present). */
export const waitForShell = async (page: Page): Promise<void> => {
  await page.getByRole('navigation', { name: 'Primary' }).waitFor({ state: 'visible' })
}

/**
 * Waits until every finite CSS/Web animation has finished and two frames have been painted, so a
 * screenshot never captures a mid-transition frame. Infinite animations (spinners) are ignored.
 */
export const settle = async (page: Page): Promise<void> => {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getComputedTiming().iterations === Infinity
      )
  )
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()))
      })
  )
}
