import type { DatabaseSync } from 'node:sqlite'
import type { DismissedWarning } from '@shared/types/settings'
import { changeBus } from '../changeBus'
import { fromJson, notFound, nowIso, prepared, str, toJson, type Row } from './shared'

const COLUMNS = 'key, dismissed_at, payload_json'

export const rowToDismissedWarning = (row: Row): DismissedWarning => ({
  key: str(row.key),
  dismissedAt: str(row.dismissed_at),
  payload: fromJson<unknown>(row.payload_json)
})

export const listDismissedWarnings = (db: DatabaseSync): DismissedWarning[] =>
  prepared(db, `SELECT ${COLUMNS} FROM dismissed_warnings ORDER BY dismissed_at, key`)
    .all()
    .map(rowToDismissedWarning)

export const findDismissedWarning = (
  db: DatabaseSync,
  key: string
): DismissedWarning | undefined => {
  const row = prepared(db, `SELECT ${COLUMNS} FROM dismissed_warnings WHERE key = ?`).get(key)
  return row ? rowToDismissedWarning(row) : undefined
}

export const dismissWarning = (
  db: DatabaseSync,
  key: string,
  payload?: unknown
): DismissedWarning => {
  prepared(
    db,
    `INSERT INTO dismissed_warnings (${COLUMNS}) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET dismissed_at = excluded.dismissed_at, payload_json = excluded.payload_json`
  ).run(key, nowIso(), toJson(payload))
  changeBus.emit('dismissedWarnings')
  const warning = findDismissedWarning(db, key)
  if (!warning) throw notFound('Dismissed warning', key)
  return warning
}

/** Restores (un-dismisses) a warning; restoring an unknown key is a no-op. */
export const restoreWarning = (db: DatabaseSync, key: string): void => {
  prepared(db, 'DELETE FROM dismissed_warnings WHERE key = ?').run(key)
  changeBus.emit('dismissedWarnings')
}

export const clearDismissedWarnings = (db: DatabaseSync): void => {
  prepared(db, 'DELETE FROM dismissed_warnings').run()
  changeBus.emit('dismissedWarnings')
}
