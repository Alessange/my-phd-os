import type { DatabaseSync } from 'node:sqlite'
import type {
  CreatePersonalDeadlineInput,
  UpdatePersonalDeadlineInput
} from '@shared/schemas/personalDeadline'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { changeBus } from '../changeBus'
import {
  buildSet,
  fromJson,
  newId,
  notFound,
  nowIso,
  num,
  optStr,
  orNull,
  prepared,
  str,
  toJson,
  toStoredInstant,
  type Row
} from './shared'

const COLUMNS = `id, title, description, tracking_start_at, deadline_at, timezone, category,
  priority, status, progress, source_url, location, tags_json, linked_milestone_id,
  linked_calendar_event_id, created_at, updated_at`

export const rowToPersonalDeadline = (row: Row): PersonalDeadline => ({
  id: str(row.id),
  title: str(row.title),
  description: optStr(row.description),
  trackingStartAt: str(row.tracking_start_at),
  deadlineAt: str(row.deadline_at),
  timezone: str(row.timezone),
  category: str(row.category) as PersonalDeadline['category'],
  priority: str(row.priority) as PersonalDeadline['priority'],
  status: str(row.status) as PersonalDeadline['status'],
  progress: num(row.progress),
  sourceUrl: optStr(row.source_url),
  location: optStr(row.location),
  tags: fromJson<string[]>(row.tags_json),
  linkedMilestoneId: optStr(row.linked_milestone_id),
  linkedCalendarEventId: optStr(row.linked_calendar_event_id),
  createdAt: str(row.created_at),
  updatedAt: str(row.updated_at)
})

type ParsedCreate = Omit<CreatePersonalDeadlineInput, 'status' | 'progress' | 'priority'> &
  Pick<PersonalDeadline, 'status' | 'progress' | 'priority'>

export const listPersonalDeadlines = (
  db: DatabaseSync,
  options: { includeCompleted?: boolean } = {}
): PersonalDeadline[] =>
  prepared(
    db,
    `SELECT ${COLUMNS} FROM personal_deadlines
     ${options.includeCompleted ? '' : "WHERE status <> 'completed'"}
     ORDER BY deadline_at, title`
  )
    .all()
    .map(rowToPersonalDeadline)

export const findPersonalDeadline = (
  db: DatabaseSync,
  id: string
): PersonalDeadline | undefined => {
  const row = prepared(db, `SELECT ${COLUMNS} FROM personal_deadlines WHERE id = ?`).get(id)
  return row ? rowToPersonalDeadline(row) : undefined
}

export const getPersonalDeadline = (db: DatabaseSync, id: string): PersonalDeadline => {
  const deadline = findPersonalDeadline(db, id)
  if (!deadline) throw notFound('Personal deadline', id)
  return deadline
}

export const createPersonalDeadline = (db: DatabaseSync, input: ParsedCreate): PersonalDeadline => {
  const id = newId()
  const now = nowIso()
  prepared(
    db,
    `INSERT INTO personal_deadlines (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title,
    orNull(input.description),
    toStoredInstant(input.trackingStartAt),
    toStoredInstant(input.deadlineAt),
    input.timezone,
    input.category,
    input.priority,
    input.status,
    input.progress,
    orNull(input.sourceUrl),
    orNull(input.location),
    toJson(input.tags),
    orNull(input.linkedMilestoneId),
    null,
    now,
    now
  )
  changeBus.emit('personalDeadlines')
  return getPersonalDeadline(db, id)
}

export const updatePersonalDeadline = (
  db: DatabaseSync,
  id: string,
  patch: UpdatePersonalDeadlineInput & { linkedCalendarEventId?: string | null }
): PersonalDeadline => {
  getPersonalDeadline(db, id)
  const { clause, values } = buildSet({
    title: patch.title,
    description: patch.description,
    tracking_start_at:
      patch.trackingStartAt === undefined ? undefined : toStoredInstant(patch.trackingStartAt),
    deadline_at: patch.deadlineAt === undefined ? undefined : toStoredInstant(patch.deadlineAt),
    timezone: patch.timezone,
    category: patch.category,
    priority: patch.priority,
    status: patch.status,
    progress: patch.progress,
    source_url: patch.sourceUrl,
    location: patch.location,
    tags_json: patch.tags === undefined ? undefined : JSON.stringify(patch.tags),
    linked_milestone_id: patch.linkedMilestoneId,
    linked_calendar_event_id: patch.linkedCalendarEventId,
    updated_at: nowIso()
  })
  prepared(db, `UPDATE personal_deadlines SET ${clause} WHERE id = ?`).run(...values, id)
  changeBus.emit('personalDeadlines')
  return getPersonalDeadline(db, id)
}

export const setPersonalDeadlineProgress = (
  db: DatabaseSync,
  id: string,
  progress: number
): PersonalDeadline => updatePersonalDeadline(db, id, { progress })

export const deletePersonalDeadline = (db: DatabaseSync, id: string): void => {
  getPersonalDeadline(db, id)
  prepared(db, 'DELETE FROM personal_deadlines WHERE id = ?').run(id)
  changeBus.emit('personalDeadlines')
}
