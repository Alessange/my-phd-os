import { describe, expect, it } from 'vitest'
import { AppError } from '@shared/errors'
import type { WindowApi } from '@shared/ipc/contract'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE } from '@shared/types/settings'
import { windowApi } from '../../../tests/setup/renderer'

// Verifies the renderer test environment: jsdom, jest-dom matchers and the window.api mock.
const api = (window as unknown as { api: WindowApi }).api

describe('renderer test setup', () => {
  it('installs the shared window.api mock', () => {
    expect(api).toBe(windowApi)
    expect(document.body).toBeInTheDocument()
  })

  it('rejects unregistered channels with NOT_IMPLEMENTED', async () => {
    await expect(api.invoke('habits:list')).rejects.toBeInstanceOf(AppError)
    await expect(api.invoke('habits:list')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })

  it('returns registered responses and delivers events', async () => {
    windowApi.respond('settings:get', { settings: DEFAULT_SETTINGS, ui: DEFAULT_UI_STATE })
    await expect(api.invoke('settings:get')).resolves.toEqual({
      settings: DEFAULT_SETTINGS,
      ui: DEFAULT_UI_STATE
    })

    const received: string[][] = []
    const unsubscribe = api.on('data:changed', (payload) => received.push(payload.entities))
    windowApi.emit('data:changed', { entities: ['habits'] })
    unsubscribe()
    windowApi.emit('data:changed', { entities: ['milestones'] })
    expect(received).toEqual([['habits']])
  })
})
