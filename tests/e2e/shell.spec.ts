import { expect, test, type Locator, type Page } from '@playwright/test'
import { launchApp, waitForShell, type LaunchedApp } from './helpers/launchApp'
import { realUserDataDir, snapshotDirectory } from './helpers/realUserData'
import type { SettingsBundle } from '../../src/shared/types/settings'

/**
 * Application-shell end-to-end coverage (spec §8, §19, §26). Every test gets a fresh temporary
 * `userData`; the persistence tests relaunch against the same temp directory.
 */

const PAGES = ['Calendar', 'Deadlines', 'Timeline', 'Habits', 'Settings'] as const
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

const realUserData = realUserDataDir()
let realUserDataBefore: string[]

let launched: LaunchedApp

test.beforeAll(() => {
  realUserDataBefore = snapshotDirectory(realUserData)
})

test.beforeEach(async () => {
  launched = await launchApp()
  await waitForShell(launched.page)
})

test.afterEach(async () => {
  await launched?.close()
})

const sidebarItems = (page: Page): Locator =>
  page.getByRole('navigation', { name: 'Primary' }).getByRole('button')

const currentPageHeading = (page: Page): Locator => page.locator('main h1')

const clickSidebar = async (page: Page, label: (typeof PAGES)[number]): Promise<void> => {
  await sidebarItems(page).filter({ hasText: label }).click()
  await expect(currentPageHeading(page)).toHaveText(label)
}

const settingsBundle = (page: Page): Promise<SettingsBundle> =>
  page.evaluate(() => window.api.invoke('settings:get'))

test('launches with the right title and no console errors, page errors or CSP violations', async () => {
  const { page, consoleErrors, consoleMessages, pageErrors, app } = launched
  await expect.poll(() => page.title()).toBe('My PhD OS')
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  expect(await currentPageHeading(page).textContent()).toBe('Calendar')
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
  const cspViolations = consoleMessages.filter((line) =>
    /content security policy|refused to (load|execute|apply|connect)/i.test(line.text)
  )
  expect(cspViolations).toEqual([])
})

test('sidebar lists the five pages in spec order and Calendar is the default page', async () => {
  const { page } = launched
  const items = sidebarItems(page)
  await expect(items).toHaveCount(5)
  const labels = await items.evaluateAll((buttons) =>
    buttons.map((button) => button.querySelector('span')?.textContent?.trim() ?? '')
  )
  expect(labels).toEqual([...PAGES])
  await expect(items.nth(0)).toHaveAttribute('aria-current', 'page')
  await expect(items.nth(1)).not.toHaveAttribute('aria-current', 'page')
  await expect(currentPageHeading(page)).toHaveText('Calendar')
  await expect(page.getByRole('banner').getByText('Calendar', { exact: true })).toBeVisible()
})

test('every page shows its exact empty-state text on a fresh install', async () => {
  const { page } = launched

  await expect(
    page.getByRole('status').filter({ hasText: 'Your calendar is empty.' })
  ).toBeVisible()
  await expect(page.getByText('Your calendar is empty.', { exact: true })).toBeVisible()

  await clickSidebar(page, 'Deadlines')
  await expect(page.getByRole('tab', { name: 'Conference Deadlines' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByText('No conference subscription yet.', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Personal Deadlines' }).click()
  await expect(page.getByText('No personal deadlines yet.', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Countdowns and progress tracking appear after you add a deadline.')
  ).toBeVisible()

  await clickSidebar(page, 'Timeline')
  await expect(page.getByText('Your timeline starts here.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Milestone' }).first()).toBeVisible()

  await clickSidebar(page, 'Habits')
  await expect(page.getByText('No habits yet.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create Habit' }).first()).toBeVisible()

  await clickSidebar(page, 'Settings')
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()

  expect(launched.pageErrors).toEqual([])
  expect(launched.consoleErrors).toEqual([])
})

test('command palette opens with Mod+K, navigates, and closes with Escape', async () => {
  const { page } = launched
  await page.keyboard.press(`${MOD}+k`)
  const dialog = page.getByRole('dialog', { name: 'Command palette' })
  await expect(dialog).toBeVisible()
  const input = dialog.getByRole('combobox', { name: 'Search commands' })
  await expect(input).toBeFocused()
  await expect(dialog.getByRole('option', { name: /Go to Calendar/ })).toBeVisible()

  await input.fill('Go to Habits')
  await expect(dialog.getByRole('option', { name: /Go to Habits/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(currentPageHeading(page)).toHaveText('Habits')

  await page.keyboard.press(`${MOD}+k`)
  await expect(dialog).toBeVisible()
  await input.fill('dark theme')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)

  await page.keyboard.press(`${MOD}+k`)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page
    .getByRole('banner')
    .getByRole('button', { name: /Open command palette/ })
    .click()
  await expect(dialog).toBeVisible()
  await input.fill('Settings: About')
  await page.keyboard.press('Enter')
  await expect(currentPageHeading(page)).toHaveText('Settings')
  expect(launched.pageErrors).toEqual([])
})

test('Mod+1…5 switch pages', async () => {
  const { page } = launched
  for (const [index, label] of PAGES.entries()) {
    await page.keyboard.press(`${MOD}+${index + 1}`)
    await expect(currentPageHeading(page)).toHaveText(label)
    await expect(sidebarItems(page).nth(index)).toHaveAttribute('aria-current', 'page')
  }
  await page.keyboard.press(`${MOD}+1`)
  await expect(currentPageHeading(page)).toHaveText('Calendar')
  const bundle = await settingsBundle(page)
  expect(bundle.ui.lastPage).toBe('calendar')
})

test('Dark theme chosen in Settings applies the dark class and survives a relaunch with the last page', async () => {
  const { page, userDataDir } = launched
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)

  await clickSidebar(page, 'Settings')
  const themeGroup = page.locator('#general').getByRole('radiogroup', { name: 'Theme' })
  await themeGroup.getByRole('radio', { name: 'Dark' }).click()
  await expect(themeGroup.getByRole('radio', { name: 'Dark' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await expect.poll(async () => (await settingsBundle(page)).settings.theme).toBe('dark')
  await expect.poll(async () => (await settingsBundle(page)).ui.lastPage).toBe('settings')

  await launched.close({ keepUserData: true })
  launched = await launchApp({ userDataDir })
  await waitForShell(launched.page)
  await expect(launched.page.locator('html')).toHaveClass(/\bdark\b/)
  await expect(currentPageHeading(launched.page)).toHaveText('Settings')
  await expect(sidebarItems(launched.page).nth(4)).toHaveAttribute('aria-current', 'page')
  const restored = await settingsBundle(launched.page)
  expect(restored.settings.theme).toBe('dark')
  expect(restored.ui.lastPage).toBe('settings')
  expect(launched.pageErrors).toEqual([])
})

test('window bounds persist across relaunch', async () => {
  const { app, userDataDir } = launched
  const target = { x: 120, y: 100, width: 1180, height: 700 }
  await app.evaluate(({ BrowserWindow }, bounds) => {
    BrowserWindow.getAllWindows()[0].setBounds(bounds)
  }, target)
  const applied = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getBounds()
  )
  // Give the debounced persistence (300 ms) time to write before quitting.
  await launched.page.waitForTimeout(600)
  await launched.close({ keepUserData: true })

  launched = await launchApp({ userDataDir })
  await waitForShell(launched.page)
  const restored = await launched.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getBounds()
  )
  const tolerance = 4
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(
      Math.abs(restored[key] - applied[key]),
      `${key}: ${restored[key]} vs ${applied[key]}`
    ).toBeLessThanOrEqual(tolerance)
  }
})

test('renderer is sandboxed: no window.require, window.api exposes only invoke/on/off, unknown channels reject', async () => {
  const { page } = launched
  const shape = await page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
    apiKeys: Object.keys(window.api).sort(),
    apiTypes: Object.values(window.api).map((value) => typeof value)
  }))
  expect(shape).toEqual({
    require: 'undefined',
    process: 'undefined',
    apiKeys: ['invoke', 'off', 'on'],
    apiTypes: ['function', 'function', 'function']
  })
  const rejection = await page.evaluate(() =>
    (window.api.invoke as (channel: string) => Promise<unknown>)('fs:readFile')
      .then(() => 'resolved')
      .catch((error: { code?: string; message?: string }) => ({
        code: error.code,
        message: error.message
      }))
  )
  expect(rejection).toEqual({
    code: 'VALIDATION',
    message: 'Unknown IPC channel "fs:readFile"'
  })
})

test('a fresh install has zero user rows and follows no conference', async () => {
  const { page, userDataDir } = launched
  const storage = await page.evaluate(() => window.api.invoke('data:getStorageInfo'))
  expect(storage.userDataPath).toBe(userDataDir)
  expect(Object.keys(storage.counts).length).toBeGreaterThan(0)
  for (const [entity, count] of Object.entries(storage.counts)) {
    expect(count, `${entity} should be empty on a fresh install`).toBe(0)
  }
  const followed = await page.evaluate(() => window.api.invoke('conferences:listFollowed'))
  expect(followed).toEqual([])
  const subscriptions = await page.evaluate(() =>
    window.api.invoke('conferences:listSubscriptions')
  )
  expect(subscriptions).toEqual([])
})

test('nothing was written to the real userData directory', async () => {
  // Runs last (workers: 1, file order). Every previous test launched at least one app instance.
  expect(launched.userDataDir).not.toBe(realUserData)
  expect(snapshotDirectory(realUserData)).toEqual(realUserDataBefore)
})
