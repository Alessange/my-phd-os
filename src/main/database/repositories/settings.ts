import type { DatabaseSync } from 'node:sqlite'
import type { z } from 'zod'
import { appSettingsSchema, uiStateSchema } from '@shared/schemas/settings'
import {
  DEFAULT_SETTINGS,
  DEFAULT_UI_STATE,
  type AppSettings,
  type SettingsBundle,
  type UiState
} from '@shared/types/settings'
import { changeBus } from '../changeBus'
import { fromJson, nowIso, prepared } from './shared'

export const SETTINGS_KEYS = { app: 'app', ui: 'ui', window: 'window' } as const
export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS]

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

export const readJsonSetting = <T>(db: DatabaseSync, key: SettingsKey): T | undefined =>
  fromJson<T>(prepared(db, 'SELECT value_json FROM settings WHERE key = ?').get(key)?.value_json)

export const writeJsonSetting = (db: DatabaseSync, key: SettingsKey, value: unknown): void => {
  prepared(
    db,
    `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(value), nowIso())
}

/**
 * Merges a stored (possibly partial or stale) document over its defaults, then drops any field the
 * schema rejects so a corrupt value never propagates. Returns a fully valid document.
 */
const mergeWithDefaults = <T extends Record<string, unknown>>(
  defaults: T,
  stored: unknown,
  schema: z.ZodType<T>
): T => {
  const merged: Record<string, unknown> = { ...defaults }
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(defaults)) {
      const value = (stored as Record<string, unknown>)[key]
      if (value !== undefined) merged[key] = value
    }
  }
  const parsed = schema.safeParse(merged)
  if (parsed.success) return parsed.data
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string') merged[key] = defaults[key]
  }
  return schema.parse(merged)
}

export const getSettings = (db: DatabaseSync): AppSettings =>
  mergeWithDefaults(DEFAULT_SETTINGS, readJsonSetting(db, 'app'), appSettingsSchema)

export const getUiState = (db: DatabaseSync): UiState =>
  mergeWithDefaults(DEFAULT_UI_STATE, readJsonSetting(db, 'ui'), uiStateSchema)

export const getSettingsBundle = (db: DatabaseSync): SettingsBundle => ({
  settings: getSettings(db),
  ui: getUiState(db)
})

export const patchSettings = (db: DatabaseSync, patch: Partial<AppSettings>): AppSettings => {
  const next = appSettingsSchema.parse({ ...getSettings(db), ...stripUndefined(patch) })
  writeJsonSetting(db, 'app', next)
  changeBus.emit('settings')
  return next
}

export const patchUiState = (db: DatabaseSync, patch: Partial<UiState>): UiState => {
  const next = uiStateSchema.parse({ ...getUiState(db), ...stripUndefined(patch) })
  writeJsonSetting(db, 'ui', next)
  changeBus.emit('settings')
  return next
}

export const getWindowState = (db: DatabaseSync): WindowState | undefined => {
  const stored = readJsonSetting<Partial<WindowState>>(db, 'window')
  if (!stored || typeof stored.width !== 'number' || typeof stored.height !== 'number')
    return undefined
  return {
    x: typeof stored.x === 'number' ? stored.x : undefined,
    y: typeof stored.y === 'number' ? stored.y : undefined,
    width: stored.width,
    height: stored.height,
    isMaximized: stored.isMaximized === true
  }
}

/** Window state is main-process only; it does not emit `data:changed`. */
export const setWindowState = (db: DatabaseSync, state: WindowState): void =>
  writeJsonSetting(db, 'window', state)

const stripUndefined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
