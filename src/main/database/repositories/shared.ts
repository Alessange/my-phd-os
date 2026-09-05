import type { DatabaseSync, SQLOutputValue, StatementSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { AppError } from '@shared/errors'
import { isAllDayDate } from '@shared/dates/allDay'

export type Row = Record<string, SQLOutputValue>

const statementCache = new WeakMap<DatabaseSync, Map<string, StatementSync>>()

/** Prepared statement, cached per connection. */
export const prepared = (db: DatabaseSync, sql: string): StatementSync => {
  let cache = statementCache.get(db)
  if (!cache) {
    cache = new Map()
    statementCache.set(db, cache)
  }
  let statement = cache.get(sql)
  if (!statement) {
    statement = db.prepare(sql)
    cache.set(sql, statement)
  }
  return statement
}

export const newId = (): string => randomUUID()
export const nowIso = (): string => new Date().toISOString()

export const str = (value: SQLOutputValue): string => String(value)
type Maybe = SQLOutputValue | undefined

export const optStr = (value: Maybe): string | undefined =>
  value === null || value === undefined ? undefined : String(value)
export const num = (value: SQLOutputValue): number => Number(value)
export const optNum = (value: Maybe): number | undefined =>
  value === null || value === undefined ? undefined : Number(value)
export const bool = (value: SQLOutputValue): boolean => Number(value) === 1
export const toInt = (value: boolean | undefined): number => (value ? 1 : 0)
export const orNull = <T>(value: T | undefined): T | null => (value === undefined ? null : value)

export const toJson = (value: unknown): string | null =>
  value === undefined ? null : JSON.stringify(value)

export const fromJson = <T>(value: Maybe): T | undefined => {
  if (value === null || value === undefined) return undefined
  try {
    return JSON.parse(String(value)) as T
  } catch (error) {
    throw new AppError('INTERNAL', 'Stored JSON column is corrupted', {
      reason: error instanceof Error ? error.message : String(error)
    })
  }
}

/** Normalises an ISO instant to `…Z`; all-day `YYYY-MM-DD` values pass through unchanged. */
export const toStoredInstant = (value: string): string => {
  if (isAllDayDate(value)) return value
  const dt = DateTime.fromISO(value, { setZone: true })
  if (!dt.isValid) throw new AppError('VALIDATION', `Invalid instant "${value}"`)
  return dt.toUTC().toISO() as string
}

export const optStoredInstant = (value: string | undefined): string | null =>
  value === undefined ? null : toStoredInstant(value)

/** Builds `SET a = ?, b = ?` from a column→value map, skipping `undefined` values. */
export const buildSet = (
  columns: Record<string, SQLOutputValue | undefined>
): { clause: string; values: SQLOutputValue[] } => {
  const entries = Object.entries(columns).filter(([, v]) => v !== undefined) as [
    string,
    SQLOutputValue
  ][]
  return {
    clause: entries.map(([column]) => `${column} = ?`).join(', '),
    values: entries.map(([, value]) => value)
  }
}

export const notFound = (entity: string, id: string): AppError =>
  new AppError('NOT_FOUND', `${entity} not found`, { id })

export const countRows = (db: DatabaseSync, table: string): number =>
  num(prepared(db, `SELECT COUNT(*) AS n FROM ${table}`).get()?.n ?? 0)
