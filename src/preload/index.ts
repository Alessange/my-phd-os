import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { isChannelName, type WindowApi } from '../shared/ipc/contract'
import { IPC_ERROR_KEY, isIpcErrorEnvelope } from '../shared/ipc/envelope'
import { isEventName } from '../shared/ipc/events'
import type { IpcError } from '../shared/types/common'

const rejection = (code: IpcError['code'], message: string, details?: unknown): IpcError =>
  details === undefined ? { code, message } : { code, message, details }

type Listener = (payload: unknown) => void
type Wrapped = (event: IpcRendererEvent, payload: unknown) => void
const wrappers = new Map<string, Map<Listener, Wrapped>>()

const api: WindowApi = {
  invoke: async (channel, payload?) => {
    if (!isChannelName(channel)) {
      throw rejection('VALIDATION', `Unknown IPC channel "${String(channel)}"`)
    }
    const result: unknown = await ipcRenderer.invoke(channel, payload)
    if (isIpcErrorEnvelope(result)) {
      const error = result[IPC_ERROR_KEY]
      throw rejection(error.code, error.message, error.details)
    }
    return result as never
  },

  on: (event, listener) => {
    if (!isEventName(event)) throw rejection('VALIDATION', `Unknown event "${String(event)}"`)
    const perEvent = wrappers.get(event) ?? new Map<Listener, Wrapped>()
    wrappers.set(event, perEvent)
    // The same callback is registered once per event; a second `on` returns the same unsubscribe.
    if (!perEvent.has(listener as Listener)) {
      const wrapped: Wrapped = (_event, payload) => (listener as Listener)(payload)
      perEvent.set(listener as Listener, wrapped)
      ipcRenderer.on(event, wrapped)
    }
    return () => api.off(event, listener)
  },

  off: (event, listener) => {
    const perEvent = wrappers.get(event)
    const wrapped = perEvent?.get(listener as Listener)
    if (!perEvent || !wrapped) return
    perEvent.delete(listener as Listener)
    if (perEvent.size === 0) wrappers.delete(event)
    ipcRenderer.removeListener(event, wrapped)
  }
}

contextBridge.exposeInMainWorld('api', api)
