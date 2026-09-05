import { join } from 'node:path'
import log from 'electron-log/main'
import { AppError, toIpcError, type IpcError } from '@shared/errors'

export const LOG_FILE_NAME = 'main.log'
const MAX_LOG_BYTES = 5 * 1024 * 1024

/** Detail keys that are safe to log (identifiers, counts, codes — never user content). */
const SAFE_DETAIL_KEYS = new Set([
  'id',
  'ids',
  'code',
  'count',
  'version',
  'name',
  'path',
  'table',
  'channel',
  'field',
  'host',
  'url',
  'status',
  'reason',
  'issues',
  'entity'
])

export interface LoggerOptions {
  logsDir: string
  console: boolean
}

export const logPathFor = (logsDir: string): string => join(logsDir, LOG_FILE_NAME)

export const initLogger = ({ logsDir, console: enableConsole }: LoggerOptions): void => {
  log.transports.file.resolvePathFn = () => logPathFor(logsDir)
  log.transports.file.maxSize = MAX_LOG_BYTES
  log.transports.file.level = 'info'
  log.transports.console.level = enableConsole ? 'debug' : false
  log.errorHandler.startCatching({ showDialog: false })
}

export const logger = log

/** Keeps only primitive values under allow-listed keys so personal payloads never reach the log. */
export const sanitizeDetails = (details: unknown): Record<string, unknown> | undefined => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (!SAFE_DETAIL_KEYS.has(key)) continue
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) safe[key] = value
    else if (Array.isArray(value)) safe[key] = `[${value.length} items]`
  }
  return Object.keys(safe).length ? safe : undefined
}

/** Logs an error as `code · message` plus sanitised details; returns the IPC envelope. */
export const logAppError = (scope: string, error: unknown): IpcError => {
  const ipcError = toIpcError(error)
  const safe = sanitizeDetails(ipcError.details)
  const line = `[${scope}] ${ipcError.code}: ${ipcError.message}`
  const isExpected =
    error instanceof AppError &&
    ['VALIDATION', 'NOT_FOUND', 'CONFLICT', 'CANCELED', 'NOT_IMPLEMENTED'].includes(error.code)
  if (isExpected) log.warn(line, safe ?? '')
  else
    log.error(
      line,
      safe ?? '',
      error instanceof Error && !(error instanceof AppError) ? error.stack : ''
    )
  return ipcError
}
