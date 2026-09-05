import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_ERROR_KEY } from '../../../src/shared/ipc/envelope'
import type { WindowApi } from '../../../src/shared/ipc/contract'

type IpcListener = (event: unknown, payload: unknown) => void

const exposed: { api?: WindowApi } = {}
const invoke = vi.fn()
const ipcListeners = new Map<string, IpcListener[]>()

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown) => {
      if (key === 'api') exposed.api = value as WindowApi
    }
  },
  ipcRenderer: {
    invoke,
    on: (event: string, listener: IpcListener) => {
      ipcListeners.set(event, [...(ipcListeners.get(event) ?? []), listener])
    },
    removeListener: (event: string, listener: IpcListener) => {
      ipcListeners.set(
        event,
        (ipcListeners.get(event) ?? []).filter((l) => l !== listener)
      )
    }
  }
}))

await import('../../../src/preload/index')
const api = exposed.api!

const emit = (event: string, payload: unknown): void =>
  (ipcListeners.get(event) ?? []).forEach((listener) => listener({}, payload))

describe('preload bridge', () => {
  beforeEach(() => {
    invoke.mockReset()
    ipcListeners.clear()
  })

  it('exposes exactly invoke / on / off', () => {
    expect(Object.keys(api).sort()).toEqual(['invoke', 'off', 'on'])
  })

  it('rejects unknown channels and events before reaching main', async () => {
    await expect(
      (api.invoke as (channel: string) => Promise<unknown>)('fs:readFile')
    ).rejects.toEqual({ code: 'VALIDATION', message: 'Unknown IPC channel "fs:readFile"' })
    expect(invoke).not.toHaveBeenCalled()
    expect(() => (api.on as (e: string, l: () => void) => void)('evil:event', () => {})).toThrow()
  })

  it('unwraps the shared error envelope into a rejected IpcError and passes results through', async () => {
    invoke.mockResolvedValueOnce({
      [IPC_ERROR_KEY]: { code: 'NOT_FOUND', message: 'Milestone not found', details: { id: 'x' } }
    })
    await expect(api.invoke('milestones:get', { id: 'x' })).rejects.toEqual({
      code: 'NOT_FOUND',
      message: 'Milestone not found',
      details: { id: 'x' }
    })
    invoke.mockResolvedValueOnce({ ok: true })
    await expect(api.invoke('settings:get')).resolves.toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledWith('settings:get', undefined)
  })

  it('registers the same listener once per event and removes it fully on off()', () => {
    const received: unknown[] = []
    const listener = (payload: { entities: string[] }): void => {
      received.push(payload.entities)
    }
    const unsubscribeA = api.on('data:changed', listener)
    const unsubscribeB = api.on('data:changed', listener)
    expect(ipcListeners.get('data:changed')).toHaveLength(1)

    emit('data:changed', { entities: ['habits'] })
    expect(received).toEqual([['habits']])

    unsubscribeA()
    emit('data:changed', { entities: ['milestones'] })
    unsubscribeB()
    api.off('data:changed', listener)
    emit('data:changed', { entities: ['settings'] })
    expect(received).toEqual([['habits']])
    expect(ipcListeners.get('data:changed')).toEqual([])
  })
})
