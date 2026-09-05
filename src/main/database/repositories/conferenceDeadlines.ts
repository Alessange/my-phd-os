import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type { ListConferenceDeadlinesRequest } from '@shared/schemas/conference'
import type {
  ConferenceDeadline,
  ConferenceDeadlineView,
  ConferenceStatus
} from '@shared/types/conference'
import { changeBus } from '../changeBus'
import { rowToFollowedConference } from './followedConferences'
import {
  bool,
  buildSet,
  newId,
  notFound,
  nowIso,
  optNum,
  optStr,
  orNull,
  prepared,
  str,
  toInt,
  type Row
} from './shared'

const COLUMN_LIST = [
  'id',
  'subscription_id',
  'upstream_uid',
  'title',
  'conference_name',
  'conference_year',
  'full_name',
  'category',
  'ccf_rank',
  'core_rank',
  'thcpl_rank',
  'deadline_round',
  'comment',
  'location',
  'conference_start_at',
  'conference_end_at',
  'deadline_at',
  'original_timezone',
  'raw_dtstart',
  'homepage_url',
  'source_url',
  'status',
  'raw_ics_data',
  'upstream_snapshot_hash',
  'upstream_updated_at',
  'created_at',
  'updated_at',
  'stable_key',
  'deadline_kind',
  'conference_dates_text',
  'dblp_url',
  'first_seen_at',
  'last_seen_at',
  'original_timezone_label',
  'all_day'
]
const COLUMNS = COLUMN_LIST.join(', ')
const PLACEHOLDERS = COLUMN_LIST.map(() => '?').join(', ')
const PREFIXED = COLUMN_LIST.map((c) => `d.${c}`).join(', ')
const FOLLOW_COLUMNS = `f.conference_deadline_id AS f_conference_deadline_id, f.followed_at AS f_followed_at,
  f.intention AS f_intention, f.progress AS f_progress, f.notes AS f_notes,
  f.calendar_event_id AS f_calendar_event_id`

const VIEW_SELECT = `SELECT ${PREFIXED}, s.label AS subscription_label, ${FOLLOW_COLUMNS}
  FROM conference_deadlines d
  JOIN conference_subscriptions s ON s.id = d.subscription_id
  LEFT JOIN followed_conferences f ON f.conference_deadline_id = d.id`

export const rowToConferenceDeadline = (row: Row): ConferenceDeadline => ({
  id: str(row.id),
  subscriptionId: str(row.subscription_id),
  upstreamUid: optStr(row.upstream_uid),
  title: str(row.title),
  conferenceName: optStr(row.conference_name),
  conferenceYear: optNum(row.conference_year),
  fullName: optStr(row.full_name),
  category: optStr(row.category),
  ccfRank: optStr(row.ccf_rank),
  coreRank: optStr(row.core_rank),
  thcplRank: optStr(row.thcpl_rank),
  deadlineRound: optStr(row.deadline_round),
  comment: optStr(row.comment),
  location: optStr(row.location),
  conferenceStartAt: optStr(row.conference_start_at),
  conferenceEndAt: optStr(row.conference_end_at),
  deadlineAt: optStr(row.deadline_at),
  originalTimezone: optStr(row.original_timezone),
  rawDtStart: optStr(row.raw_dtstart),
  homepageUrl: optStr(row.homepage_url),
  sourceUrl: str(row.source_url),
  status: str(row.status) as ConferenceStatus,
  rawIcsData: optStr(row.raw_ics_data),
  upstreamSnapshotHash: str(row.upstream_snapshot_hash),
  upstreamUpdatedAt: optStr(row.upstream_updated_at),
  createdAt: str(row.created_at),
  updatedAt: str(row.updated_at),
  stableKey: str(row.stable_key),
  deadlineKind: str(row.deadline_kind) as ConferenceDeadline['deadlineKind'],
  conferenceDatesText: optStr(row.conference_dates_text),
  dblpUrl: optStr(row.dblp_url),
  firstSeenAt: str(row.first_seen_at),
  lastSeenAt: str(row.last_seen_at),
  originalTimezoneLabel: optStr(row.original_timezone_label),
  allDay: bool(row.all_day)
})

const rowToView = (row: Row): ConferenceDeadlineView => {
  const view: ConferenceDeadlineView = {
    ...rowToConferenceDeadline(row),
    subscriptionLabel: str(row.subscription_label)
  }
  if (row.f_conference_deadline_id !== null && row.f_conference_deadline_id !== undefined) {
    view.followed = rowToFollowedConference({
      conference_deadline_id: row.f_conference_deadline_id,
      followed_at: row.f_followed_at,
      intention: row.f_intention,
      progress: row.f_progress,
      notes: row.f_notes,
      calendar_event_id: row.f_calendar_event_id
    })
  }
  return view
}

const inList = (column: string, values: readonly unknown[], params: SQLInputValue[]): string => {
  params.push(...(values as SQLInputValue[]))
  return `${column} IN (${values.map(() => '?').join(', ')})`
}

/** Deadlines matching the filter, joined with subscription label and follow state. */
export const listConferenceDeadlines = (
  db: DatabaseSync,
  filter: ListConferenceDeadlinesRequest = {}
): ConferenceDeadlineView[] => {
  const where: string[] = []
  const params: SQLInputValue[] = []
  const f = filter ?? {}
  if (f.search?.trim()) {
    const like = `%${f.search.trim().toLowerCase()}%`
    where.push(
      `(lower(d.title) LIKE ? OR lower(coalesce(d.conference_name, '')) LIKE ? OR lower(coalesce(d.full_name, '')) LIKE ?)`
    )
    params.push(like, like, like)
  }
  if (f.categories?.length) where.push(inList('d.category', f.categories, params))
  if (f.ccfRanks?.length) where.push(inList('d.ccf_rank', f.ccfRanks, params))
  if (f.coreRanks?.length) where.push(inList('d.core_rank', f.coreRanks, params))
  if (f.thcplRanks?.length) where.push(inList('d.thcpl_rank', f.thcplRanks, params))
  if (f.years?.length) where.push(inList('d.conference_year', f.years, params))
  if (f.statuses?.length) where.push(inList('d.status', f.statuses, params))
  if (f.followedOnly) where.push('f.conference_deadline_id IS NOT NULL')
  if (f.hidePassed) where.push("d.status <> 'passed'")

  const sql = `${VIEW_SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY d.deadline_at IS NULL, d.deadline_at, d.title`
  return prepared(db, sql)
    .all(...params)
    .map(rowToView)
}

export const listFollowedDeadlines = (db: DatabaseSync): ConferenceDeadlineView[] =>
  prepared(
    db,
    `${VIEW_SELECT} WHERE f.conference_deadline_id IS NOT NULL
     ORDER BY d.deadline_at IS NULL, d.deadline_at, d.title`
  )
    .all()
    .map(rowToView)

export const listDeadlinesBySubscription = (
  db: DatabaseSync,
  subscriptionId: string
): ConferenceDeadline[] =>
  prepared(db, `SELECT ${COLUMNS} FROM conference_deadlines WHERE subscription_id = ?`)
    .all(subscriptionId)
    .map(rowToConferenceDeadline)

export const findConferenceDeadline = (
  db: DatabaseSync,
  id: string
): ConferenceDeadline | undefined => {
  const row = prepared(db, `SELECT ${COLUMNS} FROM conference_deadlines WHERE id = ?`).get(id)
  return row ? rowToConferenceDeadline(row) : undefined
}

export const getConferenceDeadline = (db: DatabaseSync, id: string): ConferenceDeadline => {
  const deadline = findConferenceDeadline(db, id)
  if (!deadline) throw notFound('Conference deadline', id)
  return deadline
}

export const getConferenceDeadlineView = (db: DatabaseSync, id: string): ConferenceDeadlineView => {
  const row = prepared(db, `${VIEW_SELECT} WHERE d.id = ?`).get(id)
  if (!row) throw notFound('Conference deadline', id)
  return rowToView(row)
}

export type ConferenceDeadlineInput = Omit<
  ConferenceDeadline,
  'id' | 'createdAt' | 'updatedAt' | 'firstSeenAt' | 'lastSeenAt'
>

/**
 * Inserts or updates the row identified by `(subscriptionId, stableKey)`. Upstream data is written
 * verbatim; `firstSeenAt` is preserved and `lastSeenAt` refreshed.
 */
export const upsertConferenceDeadline = (
  db: DatabaseSync,
  input: ConferenceDeadlineInput,
  seenAt: string = nowIso()
): ConferenceDeadline => {
  const existing = prepared(
    db,
    'SELECT id FROM conference_deadlines WHERE subscription_id = ? AND stable_key = ?'
  ).get(input.subscriptionId, input.stableKey)
  const id = existing ? str(existing.id) : newId()
  if (existing) {
    const { clause, values } = buildSet({
      upstream_uid: orNull(input.upstreamUid),
      title: input.title,
      conference_name: orNull(input.conferenceName),
      conference_year: orNull(input.conferenceYear),
      full_name: orNull(input.fullName),
      category: orNull(input.category),
      ccf_rank: orNull(input.ccfRank),
      core_rank: orNull(input.coreRank),
      thcpl_rank: orNull(input.thcplRank),
      deadline_round: orNull(input.deadlineRound),
      comment: orNull(input.comment),
      location: orNull(input.location),
      conference_start_at: orNull(input.conferenceStartAt),
      conference_end_at: orNull(input.conferenceEndAt),
      deadline_at: orNull(input.deadlineAt),
      original_timezone: orNull(input.originalTimezone),
      raw_dtstart: orNull(input.rawDtStart),
      homepage_url: orNull(input.homepageUrl),
      source_url: input.sourceUrl,
      status: input.status,
      raw_ics_data: orNull(input.rawIcsData),
      upstream_snapshot_hash: input.upstreamSnapshotHash,
      upstream_updated_at: orNull(input.upstreamUpdatedAt),
      updated_at: seenAt,
      deadline_kind: input.deadlineKind,
      conference_dates_text: orNull(input.conferenceDatesText),
      dblp_url: orNull(input.dblpUrl),
      last_seen_at: seenAt,
      original_timezone_label: orNull(input.originalTimezoneLabel),
      all_day: toInt(input.allDay)
    })
    prepared(db, `UPDATE conference_deadlines SET ${clause} WHERE id = ?`).run(...values, id)
  } else {
    prepared(db, `INSERT INTO conference_deadlines (${COLUMNS}) VALUES (${PLACEHOLDERS})`).run(
      id,
      input.subscriptionId,
      orNull(input.upstreamUid),
      input.title,
      orNull(input.conferenceName),
      orNull(input.conferenceYear),
      orNull(input.fullName),
      orNull(input.category),
      orNull(input.ccfRank),
      orNull(input.coreRank),
      orNull(input.thcplRank),
      orNull(input.deadlineRound),
      orNull(input.comment),
      orNull(input.location),
      orNull(input.conferenceStartAt),
      orNull(input.conferenceEndAt),
      orNull(input.deadlineAt),
      orNull(input.originalTimezone),
      orNull(input.rawDtStart),
      orNull(input.homepageUrl),
      input.sourceUrl,
      input.status,
      orNull(input.rawIcsData),
      input.upstreamSnapshotHash,
      orNull(input.upstreamUpdatedAt),
      seenAt,
      seenAt,
      input.stableKey,
      input.deadlineKind,
      orNull(input.conferenceDatesText),
      orNull(input.dblpUrl),
      seenAt,
      seenAt,
      orNull(input.originalTimezoneLabel),
      toInt(input.allDay)
    )
  }
  changeBus.emit('conferenceDeadlines')
  return getConferenceDeadline(db, id)
}

export const setConferenceDeadlineStatus = (
  db: DatabaseSync,
  id: string,
  status: ConferenceStatus,
  deadlineAt: string | null | undefined = undefined
): ConferenceDeadline => {
  getConferenceDeadline(db, id)
  const { clause, values } = buildSet({
    status,
    deadline_at: deadlineAt,
    updated_at: nowIso()
  })
  prepared(db, `UPDATE conference_deadlines SET ${clause} WHERE id = ?`).run(...values, id)
  changeBus.emit('conferenceDeadlines')
  return getConferenceDeadline(db, id)
}

export const deleteConferenceDeadline = (db: DatabaseSync, id: string): void => {
  getConferenceDeadline(db, id)
  prepared(db, 'DELETE FROM conference_deadlines WHERE id = ?').run(id)
  changeBus.emit('conferenceDeadlines', 'followedConferences', 'conferenceChanges')
}
