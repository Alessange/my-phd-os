import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type {
  CreateCalendarEventInput,
  ListEventsRequest,
  UpdateCalendarEventInput
} from '@shared/schemas/calendar'
import type { CalendarEvent } from '@shared/types/calendar'
import { changeBus } from '../changeBus'
import {
  bool,
  buildSet,
  fromJson,
  newId,
  notFound,
  nowIso,
  optStr,
  orNull,
  prepared,
  str,
  toInt,
  toJson,
  toStoredInstant,
  type Row
} from './shared'

const COLUMN_LIST = [
  'id',
  'title',
  'description',
  'start_at',
  'end_at',
  'timezone',
  'all_day',
  'category',
  'recurrence_rule',
  'recurrence_id',
  'location',
  'source_calendar_id',
  'imported_uid',
  'linked_personal_deadline_id',
  'linked_conference_deadline_id',
  'linked_milestone_id',
  'source_managed',
  'created_at',
  'updated_at',
  'exdates_json',
  'rdates_json',
  'recurrence_master_id',
  'status',
  'source_label',
  'url'
]
const COLUMNS = COLUMN_LIST.join(', ')
const PREFIXED_COLUMNS = COLUMN_LIST.map((column) => `e.${column}`).join(', ')
const PLACEHOLDERS = COLUMN_LIST.map(() => '?').join(', ')

export const rowToCalendarEvent = (row: Row): CalendarEvent => ({
  id: str(row.id),
  title: str(row.title),
  description: optStr(row.description),
  startAt: str(row.start_at),
  endAt: str(row.end_at),
  timezone: str(row.timezone),
  allDay: bool(row.all_day),
  category: str(row.category) as CalendarEvent['category'],
  recurrenceRule: optStr(row.recurrence_rule),
  recurrenceId: optStr(row.recurrence_id),
  location: optStr(row.location),
  sourceCalendarId: optStr(row.source_calendar_id),
  importedUid: optStr(row.imported_uid),
  linkedPersonalDeadlineId: optStr(row.linked_personal_deadline_id),
  linkedConferenceDeadlineId: optStr(row.linked_conference_deadline_id),
  linkedMilestoneId: optStr(row.linked_milestone_id),
  sourceManaged: bool(row.source_managed),
  createdAt: str(row.created_at),
  updatedAt: str(row.updated_at),
  exdates: fromJson<string[]>(row.exdates_json),
  rdates: fromJson<string[]>(row.rdates_json),
  recurrenceMasterId: optStr(row.recurrence_master_id),
  status: optStr(row.status) as CalendarEvent['status'],
  sourceLabel: optStr(row.source_label),
  url: optStr(row.url)
})

type ParsedCreate = Omit<CreateCalendarEventInput, 'sourceManaged'> & { sourceManaged: boolean }

export const findEvent = (db: DatabaseSync, id: string): CalendarEvent | undefined => {
  const row = prepared(db, `SELECT ${COLUMNS} FROM calendar_events WHERE id = ?`).get(id)
  return row ? rowToCalendarEvent(row) : undefined
}

export const getEvent = (db: DatabaseSync, id: string): CalendarEvent => {
  const event = findEvent(db, id)
  if (!event) throw notFound('Calendar event', id)
  return event
}

/**
 * Events overlapping `[rangeStart, rangeEnd)`. Recurring masters that start before `rangeEnd` are
 * always included so the renderer can expand them. Events of hidden sources are excluded unless
 * `includeHiddenSources` is set; events without a source are always included.
 */
export const listEvents = (db: DatabaseSync, filter: ListEventsRequest = {}): CalendarEvent[] => {
  const where: string[] = []
  const params: SQLInputValue[] = []
  if (filter.rangeEnd) {
    where.push('e.start_at < ?')
    params.push(filter.rangeEnd)
  }
  if (filter.rangeStart) {
    where.push('(e.end_at > ? OR e.recurrence_rule IS NOT NULL)')
    params.push(filter.rangeStart)
  }
  if (filter.sourceIds?.length) {
    where.push(`e.source_calendar_id IN (${filter.sourceIds.map(() => '?').join(', ')})`)
    params.push(...filter.sourceIds)
  }
  if (filter.categories?.length) {
    where.push(`e.category IN (${filter.categories.map(() => '?').join(', ')})`)
    params.push(...filter.categories)
  }
  if (!filter.includeHiddenSources) where.push('(s.id IS NULL OR s.visible = 1)')

  const sql = `SELECT ${PREFIXED_COLUMNS}
    FROM calendar_events e LEFT JOIN calendar_sources s ON s.id = e.source_calendar_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY e.start_at, e.title`
  return prepared(db, sql)
    .all(...params)
    .map(rowToCalendarEvent)
}

export const createEvent = (db: DatabaseSync, input: ParsedCreate): CalendarEvent => {
  const id = newId()
  const now = nowIso()
  prepared(db, `INSERT INTO calendar_events (${COLUMNS}) VALUES (${PLACEHOLDERS})`).run(
    id,
    input.title,
    orNull(input.description),
    toStoredInstant(input.startAt),
    toStoredInstant(input.endAt),
    input.timezone,
    toInt(input.allDay),
    input.category,
    orNull(input.recurrenceRule),
    orNull(input.recurrenceId),
    orNull(input.location),
    orNull(input.sourceCalendarId),
    orNull(input.importedUid),
    orNull(input.linkedPersonalDeadlineId),
    orNull(input.linkedConferenceDeadlineId),
    orNull(input.linkedMilestoneId),
    toInt(input.sourceManaged),
    now,
    now,
    toJson(input.exdates),
    toJson(input.rdates),
    orNull(input.recurrenceMasterId),
    orNull(input.status),
    orNull(input.sourceLabel),
    orNull(input.url)
  )
  changeBus.emit('calendarEvents')
  return getEvent(db, id)
}

export const updateEvent = (
  db: DatabaseSync,
  id: string,
  patch: UpdateCalendarEventInput
): CalendarEvent => {
  getEvent(db, id)
  const { clause, values } = buildSet({
    title: patch.title,
    description: patch.description,
    start_at: patch.startAt === undefined ? undefined : toStoredInstant(patch.startAt),
    end_at: patch.endAt === undefined ? undefined : toStoredInstant(patch.endAt),
    timezone: patch.timezone,
    all_day: patch.allDay === undefined ? undefined : toInt(patch.allDay),
    category: patch.category,
    recurrence_rule: patch.recurrenceRule,
    recurrence_id: patch.recurrenceId,
    location: patch.location,
    source_calendar_id: patch.sourceCalendarId,
    imported_uid: patch.importedUid,
    linked_personal_deadline_id: patch.linkedPersonalDeadlineId,
    linked_conference_deadline_id: patch.linkedConferenceDeadlineId,
    linked_milestone_id: patch.linkedMilestoneId,
    source_managed: patch.sourceManaged === undefined ? undefined : toInt(patch.sourceManaged),
    exdates_json: patch.exdates === undefined ? undefined : JSON.stringify(patch.exdates),
    rdates_json: patch.rdates === undefined ? undefined : JSON.stringify(patch.rdates),
    recurrence_master_id: patch.recurrenceMasterId,
    status: patch.status,
    source_label: patch.sourceLabel,
    url: patch.url,
    updated_at: nowIso()
  })
  prepared(db, `UPDATE calendar_events SET ${clause} WHERE id = ?`).run(...values, id)
  changeBus.emit('calendarEvents')
  return getEvent(db, id)
}

export const deleteEvent = (db: DatabaseSync, id: string): void => {
  getEvent(db, id)
  prepared(db, 'DELETE FROM calendar_events WHERE id = ?').run(id)
  changeBus.emit('calendarEvents')
}
