import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { isChannelName, type WindowApi } from '../shared/ipc/contract'
import { isEventName } from '../shared/ipc/events'
import type { IpcError } from '../shared/types/common'

/** Mirrors `IPC_ERROR_KEY` in src/main/ipc/registry.ts. */
const IPC_ERROR_KEY = '__ipcError'

const isErrorEnvelope = (value: unknown): value is { [IPC_ERROR_KEY]: IpcError } =>
  typeof value === 'object' && value !== null && IPC_ERROR_KEY in value

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
    if (isErrorEnvelope(result)) {
      const error = result[IPC_ERROR_KEY]
      throw rejection(error.code, error.message, error.details)
    }
    return result as never
  },

  on: (event, listener) => {
    if (!isEventName(event)) throw rejection('VALIDATION', `Unknown event "${String(event)}"`)
    const wrapped: Wrapped = (_event, payload) => (listener as Listener)(payload)
    const perEvent = wrappers.get(event) ?? new Map<Listener, Wrapped>()
    perEvent.set(listener as Listener, wrapped)
    wrappers.set(event, perEvent)
    ipcRenderer.on(event, wrapped)
    return () => api.off(event, listener)
  },

  off: (event, listener) => {
    const wrapped = wrappers.get(event)?.get(listener as Listener)
    if (!wrapped) return
    wrappers.get(event)?.delete(listener as Listener)
    ipcRenderer.removeListener(event, wrapped)
  }
}

contextBridge.exposeInMainWorld('api', api)
