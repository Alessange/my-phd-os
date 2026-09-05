import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp, settle, waitForShell, type LaunchedApp } from './helpers/launchApp'

/**
 * Visual sanity: screenshots of every page in light and dark mode land in
 * `tests/e2e/__screenshots__/` (git-ignored) for manual inspection. This is not a pixel-diff test;
 * it asserts only that every page renders without renderer errors in both themes.
 */

const SCREENSHOT_DIR = resolve('tests/e2e/__screenshots__')
const PAGES = ['Calendar', 'Deadlines', 'Timeline', 'Habits', 'Settings'] as const
const THEMES = ['light', 'dark'] as const

let launched: LaunchedApp

test.beforeAll(async () => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
  launched = await launchApp()
  await waitForShell(launched.page)
})

test.afterAll(async () => {
  await launched?.close()
})

for (const theme of THEMES) {
  test(`every page renders in ${theme} mode`, async () => {
    const { page } = launched
    await page.evaluate((value) => window.api.invoke('settings:update', { theme: value }), theme)
    await expect(page.locator('html')).toHaveClass(
      theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/
    )
    await expect(page.locator('html')).toHaveCSS('color-scheme', theme)

    for (const label of PAGES) {
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('button')
        .filter({ hasText: label })
        .click()
      await expect(page.locator('main h1')).toHaveText(label)
      if (label === 'Deadlines') {
        await page.getByRole('tab', { name: 'Conference Deadlines' }).click()
      }
      await settle(page)
      await page.screenshot({ path: join(SCREENSHOT_DIR, `${label.toLowerCase()}-${theme}.png`) })
      if (label === 'Deadlines') {
        await page.getByRole('tab', { name: 'Personal Deadlines' }).click()
        await expect(page.getByText('No personal deadlines yet.', { exact: true })).toBeVisible()
        await settle(page)
        await page.screenshot({
          path: join(SCREENSHOT_DIR, `deadlines-personal-${theme}.png`)
        })
      }
    }

    // Command palette and collapsed sidebar, once per theme.
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
    await settle(page)
    await page.screenshot({ path: join(SCREENSHOT_DIR, `palette-${theme}.png`) })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await settle(page)
    await page.screenshot({ path: join(SCREENSHOT_DIR, `sidebar-collapsed-${theme}.png`) })
    await page.getByRole('button', { name: 'Expand sidebar' }).click()

    expect(launched.pageErrors).toEqual([])
    expect(launched.consoleErrors).toEqual([])
  })
}
