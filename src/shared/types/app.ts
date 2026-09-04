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
}

export const LOG_LEVELS = ['info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]
