import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLES,
  ENTITY_TABLES,
  emptyCounts,
  type BackupFile,
  type BackupRow,
  type BackupTableName
} from '@shared/backup/format'
import { validateBackup, type BackupValidation } from '@shared/backup/validate'
import { AppError } from '@shared/errors'
import { ENTITY_NAMES } from '@shared/ipc/events'
import type { CountableEntityName, DataCounts } from '@shared/types/common'
import type { BackupImportMode } from '@shared/types/data'
import { changeBus } from '../database/changeBus'
import { transaction } from '../database/connection'
import { appliedVersions } from '../database/migrate'
import { USER_TABLES } from '../database/repositories/maintenance'

/**
 * JSON backup export / import over the SQLite database (spec §17, §25). No Electron here: dialogs
 * and the app version are the handler's job, so this module runs unchanged in Node tests.
 */

export const currentSchemaVersion = (db: DatabaseSync): number =>
  Math.max(0, ...appliedVersions(db))

const readRows = (db: DatabaseSync, table: BackupTableName): BackupRow[] => {
  const sql =
    table === 'settings' ? `SELECT * FROM settings WHERE key <> 'window'` : `SELECT * FROM ${table}`
  return db.prepare(sql).all() as BackupRow[]
}

/** Snapshot of every user-data table (device-specific `window` bounds and `app_meta` excluded). */
export const collectBackup = (
  db: DatabaseSync,
  meta: { appVersion: string; exportedAt: string }
): BackupFile => {
  const tables: BackupFile['tables'] = {}
  for (const table of BACKUP_TABLES) tables[table] = readRows(db, table)
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: currentSchemaVersion(db),
    appVersion: meta.appVersion,
    exportedAt: meta.exportedAt,
    tables
  }
}

/** Writes the backup atomically (temp file + rename) as readable JSON. */
export const writeBackupFile = (path: string, backup: BackupFile): void => {
  const tmp = `${path}.tmp-${randomUUID().slice(0, 8)}`
  try {
    writeFileSync(tmp, JSON.stringify(backup, null, 2), 'utf8')
    renameSync(tmp, path)
  } catch (error) {
    throw new AppError('IO', 'Could not write the backup file', {
      reason: error instanceof Error ? error.message : String(error)
    })
  }
}

/** Reads and validates a backup file; malformed JSON is an `INVALID_BACKUP` result, not a throw. */
export const readBackupFile = (path: string, schemaVersion: number): BackupValidation => {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    throw new AppError('IO', 'Could not read the backup file', {
      reason: error instanceof Error ? error.message : String(error)
    })
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, code: 'INVALID_BACKUP', message: 'The file is not valid JSON' }
  }
  return validateBackup(raw, schemaVersion)
}

interface ColumnInfo {
  name: string
  pk: number
}

const tableColumns = (db: DatabaseSync, table: BackupTableName): ColumnInfo[] =>
  // `table` comes from BACKUP_TABLES, never from the file.
  db.prepare(`PRAGMA table_info(${table})`).all() as unknown as ColumnInfo[]

const insertRows = (
  db: DatabaseSync,
  table: BackupTableName,
  rows: readonly BackupRow[],
  mode: BackupImportMode
): number => {
  if (rows.length === 0) return 0
  const columns = tableColumns(db, table)
  const known = new Set(columns.map((c) => c.name))
  const keys = new Set(columns.filter((c) => c.pk > 0).map((c) => c.name))
  const present = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const unknown = present.filter((column) => !known.has(column))
  if (unknown.length > 0) {
    throw new AppError(
      'INVALID_BACKUP',
      `Table "${table}" has unknown columns: ${unknown.join(', ')}`,
      {
        table,
        columns: unknown
      }
    )
  }
  const updatable = present.filter((column) => !keys.has(column))
  const onConflict =
    mode === 'merge'
      ? updatable.length > 0
        ? ` ON CONFLICT DO UPDATE SET ${updatable.map((c) => `${c} = excluded.${c}`).join(', ')}`
        : ' ON CONFLICT DO NOTHING'
      : ''
  const statement = db.prepare(
    `INSERT INTO ${table} (${present.join(', ')}) VALUES (${present.map(() => '?').join(', ')})${onConflict}`
  )
  for (const row of rows) statement.run(...present.map((column) => row[column] ?? null))
  return rows.length
}

/**
 * Applies a validated backup in one transaction. `replace` empties every user table first
 * (keeping the `window` bounds and `app_meta`); `merge` upserts by primary/unique key so existing
 * rows with the same id are updated and others are kept. Foreign-key checks are deferred to
 * commit, which is what lets the deadline ↔ calendar-event cycle restore. Any failure rolls the
 * whole import back and surfaces as an error; the database is never left half-imported.
 */
export const applyBackup = (
  db: DatabaseSync,
  backup: BackupFile,
  mode: BackupImportMode
): DataCounts => {
  const imported = emptyCounts()
  try {
    transaction(db, () => {
      db.exec('PRAGMA defer_foreign_keys = ON')
      if (mode === 'replace') {
        for (const table of USER_TABLES) {
          if (table === 'app_meta') continue
          if (table === 'settings') db.exec(`DELETE FROM settings WHERE key <> 'window'`)
          else db.exec(`DELETE FROM ${table}`)
        }
      }
      for (const table of BACKUP_TABLES) {
        const count = insertRows(db, table, backup.tables[table] ?? [], mode)
        const entity = (Object.keys(ENTITY_TABLES) as CountableEntityName[]).find(
          (name) => ENTITY_TABLES[name] === table
        )
        if (entity) imported[entity] = count
      }
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('INVALID_BACKUP', 'The backup could not be imported; nothing was changed', {
      reason: error instanceof Error ? error.message : String(error)
    })
  }
  changeBus.emit(...ENTITY_NAMES)
  return imported
}

// ---------------------------------------------------------------------------
// Pending previews: a validated backup waits here between preview and commit.

export const PREVIEW_TTL_MS = 15 * 60 * 1000

const previews = new Map<string, { backup: BackupFile; expiresAt: number }>()

const prune = (now: number): void => {
  for (const [token, entry] of previews) if (entry.expiresAt <= now) previews.delete(token)
}

export const registerPreview = (backup: BackupFile, now = Date.now()): string => {
  prune(now)
  const token = randomUUID()
  previews.set(token, { backup, expiresAt: now + PREVIEW_TTL_MS })
  return token
}

/** Removes and returns the backup behind a token; undefined when unknown or expired. */
export const takePreview = (token: string, now = Date.now()): BackupFile | undefined => {
  prune(now)
  const entry = previews.get(token)
  previews.delete(token)
  return entry?.backup
}
