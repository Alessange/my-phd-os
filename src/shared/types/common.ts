import type { EntityName } from '../ipc/events'

/** ISO-8601 UTC instant, e.g. `2026-09-18T11:59:00.000Z`. */
export type IsoInstant = string
/** Calendar date without time or zone, `YYYY-MM-DD`. Never converted through a timezone. */
export type IsoDate = string
/** UUID v4 produced by `crypto.randomUUID()` in the main process. */
export type Uuid = string

export const APP_ERROR_CODES = [
  'VALIDATION',
  'NOT_FOUND',
  'CONFLICT',
  'NOT_IMPLEMENTED',
  'IO',
  'NETWORK',
  'TIMEOUT',
  'INVALID_URL',
  'UNTRUSTED_HOST',
  'INVALID_ICS',
  'INVALID_BACKUP',
  'UNSUPPORTED_BACKUP_VERSION',
  'MIGRATION_FAILED',
  'CANCELED',
  'PERMISSION',
  'INTERNAL'
] as const

export type AppErrorCode = (typeof APP_ERROR_CODES)[number]

/** Serialisable error envelope that crosses the IPC bridge. */
export interface IpcError {
  code: AppErrorCode
  message: string
  details?: unknown
}

export interface OkResponse {
  ok: true
}

export interface CanceledResult {
  canceled: true
}

export type DialogResult<T> = CanceledResult | ({ canceled: false } & T)

/** Entities that have countable rows (everything except the settings document). */
export type CountableEntityName = Exclude<EntityName, 'settings'>
export type DataCounts = Record<CountableEntityName, number>
