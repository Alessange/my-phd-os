import type { DatabaseSync } from 'node:sqlite'
import { ENTITY_TABLES } from '@shared/backup/format'
import type { CountableEntityName, DataCounts } from '@shared/types/common'
import { ENTITY_NAMES } from '@shared/ipc/events'
import { transaction } from '../connection'
import { changeBus } from '../changeBus'
import { countRows } from './shared'

export { ENTITY_TABLES }

/** Every table holding user data, in an order that satisfies foreign keys when deleting. */
export const USER_TABLES: readonly string[] = [
  'conference_deadline_changes',
  'followed_conferences',
  'habit_completions',
  'calendar_events',
  'personal_deadlines',
  'conference_deadlines',
  'conference_snapshots',
  'conference_subscriptions',
  'calendar_sources',
  'milestones',
  'habits',
  'dismissed_warnings',
  'settings',
  'app_meta'
]

export const dataCounts = (db: DatabaseSync): DataCounts =>
  Object.fromEntries(
    (Object.keys(ENTITY_TABLES) as CountableEntityName[]).map((entity) => [
      entity,
      countRows(db, ENTITY_TABLES[entity])
    ])
  ) as DataCounts

/**
 * Deletes every row of user data in one transaction, keeping the schema and migration history.
 * The `window` settings document (bounds, not user data) is preserved.
 */
export const clearAllUserData = (db: DatabaseSync): void => {
  transaction(db, () => {
    for (const table of USER_TABLES) {
      if (table === 'settings') db.exec(`DELETE FROM settings WHERE key <> 'window'`)
      else db.exec(`DELETE FROM ${table}`)
    }
  })
  changeBus.emit(...ENTITY_NAMES)
}
