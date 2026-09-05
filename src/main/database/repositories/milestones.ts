import type { DatabaseSync } from 'node:sqlite'
import type { CreateMilestoneInput, UpdateMilestoneInput } from '@shared/schemas/milestone'
import type { Milestone } from '@shared/types/milestone'
import { changeBus } from '../changeBus'
import {
  buildSet,
  newId,
  notFound,
  nowIso,
  num,
  optStr,
  orNull,
  prepared,
  str,
  toStoredInstant,
  type Row
} from './shared'

const COLUMNS =
  'id, title, description, start_at, target_at, category, status, progress, color, created_at, updated_at'

export const rowToMilestone = (row: Row): Milestone => ({
  id: str(row.id),
  title: str(row.title),
  description: optStr(row.description),
  startAt: str(row.start_at),
  targetAt: str(row.target_at),
  category: str(row.category) as Milestone['category'],
  status: str(row.status) as Milestone['status'],
  progress: num(row.progress),
  color: optStr(row.color),
  createdAt: str(row.created_at),
  updatedAt: str(row.updated_at)
})

type ParsedCreate = Omit<CreateMilestoneInput, 'status' | 'progress'> &
  Pick<Milestone, 'status' | 'progress'>

export const listMilestones = (db: DatabaseSync): Milestone[] =>
  prepared(db, `SELECT ${COLUMNS} FROM milestones ORDER BY start_at, target_at, title`)
    .all()
    .map(rowToMilestone)

export const findMilestone = (db: DatabaseSync, id: string): Milestone | undefined => {
  const row = prepared(db, `SELECT ${COLUMNS} FROM milestones WHERE id = ?`).get(id)
  return row ? rowToMilestone(row) : undefined
}

export const getMilestone = (db: DatabaseSync, id: string): Milestone => {
  const milestone = findMilestone(db, id)
  if (!milestone) throw notFound('Milestone', id)
  return milestone
}

export const createMilestone = (db: DatabaseSync, input: ParsedCreate): Milestone => {
  const id = newId()
  const now = nowIso()
  prepared(db, `INSERT INTO milestones (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    input.title,
    orNull(input.description),
    toStoredInstant(input.startAt),
    toStoredInstant(input.targetAt),
    input.category,
    input.status,
    input.progress,
    orNull(input.color),
    now,
    now
  )
  changeBus.emit('milestones')
  return getMilestone(db, id)
}

export const updateMilestone = (
  db: DatabaseSync,
  id: string,
  patch: UpdateMilestoneInput
): Milestone => {
  getMilestone(db, id)
  const { clause, values } = buildSet({
    title: patch.title,
    description: patch.description,
    start_at: patch.startAt === undefined ? undefined : toStoredInstant(patch.startAt),
    target_at: patch.targetAt === undefined ? undefined : toStoredInstant(patch.targetAt),
    category: patch.category,
    status: patch.status,
    progress: patch.progress,
    color: patch.color,
    updated_at: nowIso()
  })
  prepared(db, `UPDATE milestones SET ${clause} WHERE id = ?`).run(...values, id)
  changeBus.emit('milestones')
  return getMilestone(db, id)
}

export const deleteMilestone = (db: DatabaseSync, id: string): void => {
  getMilestone(db, id)
  prepared(db, 'DELETE FROM milestones WHERE id = ?').run(id)
  changeBus.emit('milestones', 'personalDeadlines', 'calendarEvents')
}
