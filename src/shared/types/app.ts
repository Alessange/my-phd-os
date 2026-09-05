import type { IpcError } from './common'

export interface AppInfo {
  version: string
  platform: string
  arch: string
  electron: string
  node: string
  chrome: string
  userDataPath: string
  databasePath: string
  logPath: string
  systemTimezone: string
  isPackaged: boolean
  /** Present when the database could not be opened or migrated at startup (code `MIGRATION_FAILED` or `IO`). */
  dbError?: IpcError
}

export const LOG_LEVELS = ['info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]
