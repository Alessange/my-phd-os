import type { IpcError } from '../types/common'

/**
 * Rejected IPC calls travel from main to the preload as a plain envelope rather than a thrown
 * error, because Electron serialises a thrown error down to its `message` and would drop
 * `code`/`details`. Both sides import this single definition (Decision 16, 36).
 */
export const IPC_ERROR_KEY = '__ipcError' as const

export interface IpcErrorEnvelope {
  [IPC_ERROR_KEY]: IpcError
}

export const isIpcErrorEnvelope = (value: unknown): value is IpcErrorEnvelope =>
  typeof value === 'object' && value !== null && IPC_ERROR_KEY in value
