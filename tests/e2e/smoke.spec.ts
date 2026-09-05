import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from './helpers/launchApp'

let launched: LaunchedApp

test.beforeAll(async () => {
  launched = await launchApp()
})

test.afterAll(async () => {
  await launched?.close()
})

test('opens a native window titled My PhD OS without page errors', async () => {
  const { window, pageErrors } = launched
  await expect.poll(() => window.title()).toBe('My PhD OS')
  expect(
    await launched.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
  ).toBe(1)
  expect(pageErrors).toEqual([])
})

test('exposes only window.api and no Node globals', async () => {
  const { window } = launched
  const shape = await window.evaluate(() => ({
    hasApi: typeof window.api === 'object' && window.api !== null,
    invoke: typeof window.api?.invoke,
    on: typeof window.api?.on,
    off: typeof window.api?.off,
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process
  }))
  expect(shape).toEqual({
    hasApi: true,
    invoke: 'function',
    on: 'function',
    off: 'function',
    require: 'undefined',
    process: 'undefined'
  })
})

test('app:getInfo answers over the bridge and the database exists in the temp userData', async () => {
  const { window, userDataDir } = launched
  const info = await window.evaluate(() => window.api.invoke('app:getInfo'))
  expect(info.version).toMatch(/^\d+\.\d+\.\d+/)
  expect(info.userDataPath).toBe(userDataDir)
  expect(info.databasePath).toBe(join(userDataDir, 'my-phd-os.sqlite'))
  expect(info.dbError).toBeUndefined()
  expect(existsSync(info.databasePath)).toBe(true)
  expect(existsSync(join(userDataDir, 'logs', 'main.log'))).toBe(true)
})

test('rejects invalid payloads with a typed IPC error', async () => {
  const { window } = launched
  const rejection = await window.evaluate(() =>
    window.api
      .invoke('milestones:get', { id: '' })
      .then(() => null)
      .catch((error: { code?: string; message?: string }) => ({
        code: error.code,
        message: error.message
      }))
  )
  expect(rejection).toMatchObject({ code: 'VALIDATION' })
  const unknown = await window.evaluate(() =>
    (window.api.invoke as (channel: string) => Promise<unknown>)('calendar:dropTables')
      .then(() => null)
      .catch((error: { code?: string }) => error.code)
  )
  expect(unknown).toBe('VALIDATION')
})

test('settings round-trip persists through the database', async () => {
  const { window } = launched
  const updated = await window.evaluate(() =>
    window.api.invoke('settings:update', { theme: 'dark' })
  )
  expect(updated.theme).toBe('dark')
  const bundle = await window.evaluate(() => window.api.invoke('settings:get'))
  expect(bundle.settings.theme).toBe('dark')
  expect(bundle.ui.lastPage).toBe('calendar')
})
