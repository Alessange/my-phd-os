import type { CountableEntityName, DataCounts, IsoInstant } from '../types/common'

/**
 * JSON backup envelope (spec §17 "Export full JSON backup"). The backup is a lossless, table-level
 * dump of every user-data table so ids and cross-links (deadline ↔ event, deadline → milestone)
 * survive a round trip exactly. Device-specific rows are excluded: the `window` settings document
 * and `app_meta`.
 */

export const BACKUP_FORMAT = 'my-phd-os-backup' as const
export const BACKUP_FORMAT_VERSION = 1

/** A stored cell: SQLite TEXT, INTEGER/REAL, or NULL. */
export type BackupCell = string | number | null
export type BackupRow = Record<string, BackupCell>

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  /** Highest applied database migration when the backup was written. */
  schemaVersion: number
  appVersion: string
  exportedAt: IsoInstant
  /** Table name → rows, only tables listed in `BACKUP_TABLES`. */
  tables: Partial<Record<BackupTableName, BackupRow[]>>
}

/** Table behind each countable entity (the `settings` document is not a countable entity). */
export const ENTITY_TABLES: Readonly<Record<CountableEntityName, string>> = {
  calendarEvents: 'calendar_events',
  calendarSources: 'calendar_sources',
  personalDeadlines: 'personal_deadlines',
  conferenceSubscriptions: 'conference_subscriptions',
  conferenceDeadlines: 'conference_deadlines',
  followedConferences: 'followed_conferences',
  conferenceChanges: 'conference_deadline_changes',
  milestones: 'milestones',
  habits: 'habits',
  habitCompletions: 'habit_completions',
  dismissedWarnings: 'dismissed_warnings'
}

/**
 * User-data tables in the order rows are inserted on import: parents before children. The
 * deadline ↔ event cycle is resolved by deferring foreign-key checks to commit, not by order.
 */
export const BACKUP_TABLES = [
  'settings',
  'habits',
  'milestones',
  'calendar_sources',
  'conference_subscriptions',
  'conference_snapshots',
  'conference_deadlines',
  'personal_deadlines',
  'calendar_events',
  'habit_completions',
  'followed_conferences',
  'conference_deadline_changes',
  'dismissed_warnings'
] as const
export type BackupTableName = (typeof BACKUP_TABLES)[number]

export const isBackupTableName = (value: string): value is BackupTableName =>
  (BACKUP_TABLES as readonly string[]).includes(value)

export const emptyCounts = (): DataCounts =>
  Object.fromEntries(
    (Object.keys(ENTITY_TABLES) as CountableEntityName[]).map((entity) => [entity, 0])
  ) as DataCounts

/** Rows per countable entity in a backup. */
export const countsOf = (backup: Pick<BackupFile, 'tables'>): DataCounts => {
  const counts = emptyCounts()
  for (const entity of Object.keys(ENTITY_TABLES) as CountableEntityName[]) {
    counts[entity] = backup.tables[ENTITY_TABLES[entity] as BackupTableName]?.length ?? 0
  }
  return counts
}

/** `my-phd-os-backup-2026-09-05.json` */
export const defaultBackupFileName = (exportedAt: IsoInstant): string =>
  `my-phd-os-backup-${exportedAt.slice(0, 10)}.json`
