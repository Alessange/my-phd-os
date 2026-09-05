import type { DatabaseSync } from 'node:sqlite'
import { optStr, prepared } from './shared'

export const APP_META_KEYS = {
  installedAt: 'installedAt',
  lastLaunchedAt: 'lastLaunchedAt',
  lastLaunchedVersion: 'lastLaunchedVersion'
} as const
export type AppMetaKey = (typeof APP_META_KEYS)[keyof typeof APP_META_KEYS]

export const getMeta = (db: DatabaseSync, key: AppMetaKey): string | undefined =>
  optStr(prepared(db, 'SELECT value FROM app_meta WHERE key = ?').get(key)?.value)

export const setMeta = (db: DatabaseSync, key: AppMetaKey, value: string): void => {
  prepared(
    db,
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}

export const listMeta = (db: DatabaseSync): Record<string, string> =>
  Object.fromEntries(
    prepared(db, 'SELECT key, value FROM app_meta ORDER BY key')
      .all()
      .map((row) => [String(row.key), String(row.value ?? '')])
  )

/** Records install/launch metadata. Never stores personal data. */
export const recordLaunch = (db: DatabaseSync, version: string, now: string): void => {
  if (!getMeta(db, 'installedAt')) setMeta(db, 'installedAt', now)
  setMeta(db, 'lastLaunchedAt', now)
  setMeta(db, 'lastLaunchedVersion', version)
}
