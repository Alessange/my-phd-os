import type { DatabaseSync } from 'node:sqlite'
import type { UpdateFollowPatch } from '@shared/schemas/conference'
import type { FollowIntention, FollowedConference } from '@shared/types/conference'
import { changeBus } from '../changeBus'
import {
  buildSet,
  notFound,
  nowIso,
  optNum,
  optStr,
  orNull,
  prepared,
  str,
  type Row
} from './shared'

const COLUMNS = 'conference_deadline_id, followed_at, intention, progress, notes, calendar_event_id'

export const rowToFollowedConference = (row: Row): FollowedConference => ({
  conferenceDeadlineId: str(row.conference_deadline_id),
  followedAt: str(row.followed_at),
  intention: optStr(row.intention) as FollowIntention | undefined,
  progress: optNum(row.progress),
  notes: optStr(row.notes),
  calendarEventId: optStr(row.calendar_event_id)
})

export const listFollows = (db: DatabaseSync): FollowedConference[] =>
  prepared(db, `SELECT ${COLUMNS} FROM followed_conferences ORDER BY followed_at`)
    .all()
    .map(rowToFollowedConference)

export const findFollow = (
  db: DatabaseSync,
  conferenceDeadlineId: string
): FollowedConference | undefined => {
  const row = prepared(
    db,
    `SELECT ${COLUMNS} FROM followed_conferences WHERE conference_deadline_id = ?`
  ).get(conferenceDeadlineId)
  return row ? rowToFollowedConference(row) : undefined
}

export const getFollow = (db: DatabaseSync, conferenceDeadlineId: string): FollowedConference => {
  const follow = findFollow(db, conferenceDeadlineId)
  if (!follow) throw notFound('Followed conference', conferenceDeadlineId)
  return follow
}

/** Follows a deadline (idempotent: an existing follow is returned unchanged except for intention). */
export const followConference = (
  db: DatabaseSync,
  conferenceDeadlineId: string,
  intention?: FollowIntention
): FollowedConference => {
  const existing = findFollow(db, conferenceDeadlineId)
  if (existing) {
    return intention && intention !== existing.intention
      ? updateFollow(db, conferenceDeadlineId, { intention })
      : existing
  }
  const exists = prepared(db, 'SELECT id FROM conference_deadlines WHERE id = ?').get(
    conferenceDeadlineId
  )
  if (!exists) throw notFound('Conference deadline', conferenceDeadlineId)
  prepared(
    db,
    `INSERT INTO followed_conferences (${COLUMNS}) VALUES (?, ?, ?, NULL, NULL, NULL)`
  ).run(conferenceDeadlineId, nowIso(), orNull(intention))
  changeBus.emit('followedConferences')
  return getFollow(db, conferenceDeadlineId)
}

export const updateFollow = (
  db: DatabaseSync,
  conferenceDeadlineId: string,
  patch: UpdateFollowPatch & { calendarEventId?: string | null }
): FollowedConference => {
  getFollow(db, conferenceDeadlineId)
  const { clause, values } = buildSet({
    intention: patch.intention,
    progress: patch.progress,
    notes: patch.notes,
    calendar_event_id: patch.calendarEventId
  })
  if (clause) {
    prepared(db, `UPDATE followed_conferences SET ${clause} WHERE conference_deadline_id = ?`).run(
      ...values,
      conferenceDeadlineId
    )
  }
  changeBus.emit('followedConferences')
  return getFollow(db, conferenceDeadlineId)
}

export const unfollowConference = (db: DatabaseSync, conferenceDeadlineId: string): void => {
  getFollow(db, conferenceDeadlineId)
  prepared(db, 'DELETE FROM followed_conferences WHERE conference_deadline_id = ?').run(
    conferenceDeadlineId
  )
  changeBus.emit('followedConferences')
}
