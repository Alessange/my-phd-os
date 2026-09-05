import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type { ListChangesRequest } from '@shared/schemas/conference'
import type {
  ConferenceDeadlineChange,
  ConferenceDeadlineChangeView
} from '@shared/types/conference'
import { changeBus } from '../changeBus'
import { bool, fromJson, newId, notFound, nowIso, prepared, str, type Row } from './shared'

const COLUMN_LIST = [
  'id',
  'conference_deadline_id',
  'field',
  'previous_value_json',
  'current_value_json',
  'detected_at',
  'upstream_snapshot_hash',
  'acknowledged'
]
const COLUMNS = COLUMN_LIST.join(', ')
const PREFIXED = COLUMN_LIST.map((c) => `c.${c}`).join(', ')

export const rowToConferenceChange = (row: Row): ConferenceDeadlineChange => ({
  id: str(row.id),
  conferenceDeadlineId: str(row.conference_deadline_id),
  field: str(row.field),
  previousValue: fromJson<unknown>(row.previous_value_json),
  currentValue: fromJson<unknown>(row.current_value_json),
  detectedAt: str(row.detected_at),
  upstreamSnapshotHash: str(row.upstream_snapshot_hash),
  acknowledged: bool(row.acknowledged)
})

const rowToView = (row: Row): ConferenceDeadlineChangeView => ({
  ...rowToConferenceChange(row),
  conferenceTitle: str(row.conference_title),
  followed: row.followed_id !== null && row.followed_id !== undefined
})

export const listConferenceChanges = (
  db: DatabaseSync,
  filter: ListChangesRequest = {}
): ConferenceDeadlineChangeView[] => {
  const where: string[] = []
  const params: SQLInputValue[] = []
  if (filter?.unacknowledgedOnly) where.push('c.acknowledged = 0')
  if (filter?.followedOnly) where.push('f.conference_deadline_id IS NOT NULL')
  const sql = `SELECT ${PREFIXED}, d.title AS conference_title, f.conference_deadline_id AS followed_id
    FROM conference_deadline_changes c
    JOIN conference_deadlines d ON d.id = c.conference_deadline_id
    LEFT JOIN followed_conferences f ON f.conference_deadline_id = d.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY c.detected_at DESC, d.title, c.field`
  return prepared(db, sql)
    .all(...params)
    .map(rowToView)
}

export interface RecordChangeInput {
  conferenceDeadlineId: string
  field: string
  previousValue: unknown
  currentValue: unknown
  upstreamSnapshotHash: string
  detectedAt?: string
}

export const recordConferenceChange = (
  db: DatabaseSync,
  input: RecordChangeInput
): ConferenceDeadlineChange => {
  const id = newId()
  prepared(
    db,
    `INSERT INTO conference_deadline_changes (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(
    id,
    input.conferenceDeadlineId,
    input.field,
    input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
    input.currentValue === undefined ? null : JSON.stringify(input.currentValue),
    input.detectedAt ?? nowIso(),
    input.upstreamSnapshotHash
  )
  changeBus.emit('conferenceChanges')
  const row = prepared(db, `SELECT ${COLUMNS} FROM conference_deadline_changes WHERE id = ?`).get(
    id
  )
  if (!row) throw notFound('Conference change', id)
  return rowToConferenceChange(row)
}

/** Marks the given changes acknowledged; unknown ids are ignored. Returns the number updated. */
export const acknowledgeConferenceChanges = (db: DatabaseSync, ids: readonly string[]): number => {
  if (ids.length === 0) return 0
  const result = prepared(
    db,
    `UPDATE conference_deadline_changes SET acknowledged = 1
     WHERE acknowledged = 0 AND id IN (${ids.map(() => '?').join(', ')})`
  ).run(...ids)
  changeBus.emit('conferenceChanges')
  return Number(result.changes)
}
