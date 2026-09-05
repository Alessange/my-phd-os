import type { DatabaseSync } from 'node:sqlite'
import type { CreateHabitInput, UpdateHabitInput } from '@shared/schemas/habit'
import type { Habit, HabitFrequency } from '@shared/types/habit'
import { changeBus } from '../changeBus'
import {
  buildSet,
  fromJson,
  newId,
  notFound,
  nowIso,
  optStr,
  orNull,
  prepared,
  str,
  type Row
} from './shared'

const COLUMNS = 'id, name, color, icon, frequency_json, created_at, archived_at'

export const rowToHabit = (row: Row): Habit => ({
  id: str(row.id),
  name: str(row.name),
  color: str(row.color),
  icon: optStr(row.icon),
  frequency: fromJson<HabitFrequency>(row.frequency_json) ?? { type: 'daily' },
  createdAt: str(row.created_at),
  archivedAt: optStr(row.archived_at)
})

export const listHabits = (
  db: DatabaseSync,
  options: { includeArchived?: boolean } = {}
): Habit[] =>
  prepared(
    db,
    `SELECT ${COLUMNS} FROM habits ${options.includeArchived ? '' : 'WHERE archived_at IS NULL'}
     ORDER BY created_at, name`
  )
    .all()
    .map(rowToHabit)

export const findHabit = (db: DatabaseSync, id: string): Habit | undefined => {
  const row = prepared(db, `SELECT ${COLUMNS} FROM habits WHERE id = ?`).get(id)
  return row ? rowToHabit(row) : undefined
}

export const getHabit = (db: DatabaseSync, id: string): Habit => {
  const habit = findHabit(db, id)
  if (!habit) throw notFound('Habit', id)
  return habit
}

export const createHabit = (db: DatabaseSync, input: CreateHabitInput): Habit => {
  const id = newId()
  prepared(db, `INSERT INTO habits (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, NULL)`).run(
    id,
    input.name,
    input.color,
    orNull(input.icon),
    JSON.stringify(input.frequency),
    nowIso()
  )
  changeBus.emit('habits')
  return getHabit(db, id)
}

export const updateHabit = (db: DatabaseSync, id: string, patch: UpdateHabitInput): Habit => {
  getHabit(db, id)
  const { clause, values } = buildSet({
    name: patch.name,
    color: patch.color,
    icon: patch.icon,
    frequency_json: patch.frequency === undefined ? undefined : JSON.stringify(patch.frequency)
  })
  if (clause) prepared(db, `UPDATE habits SET ${clause} WHERE id = ?`).run(...values, id)
  changeBus.emit('habits')
  return getHabit(db, id)
}

export const setHabitArchived = (db: DatabaseSync, id: string, archived: boolean): Habit => {
  getHabit(db, id)
  prepared(db, 'UPDATE habits SET archived_at = ? WHERE id = ?').run(archived ? nowIso() : null, id)
  changeBus.emit('habits')
  return getHabit(db, id)
}

export const deleteHabit = (db: DatabaseSync, id: string): void => {
  getHabit(db, id)
  prepared(db, 'DELETE FROM habits WHERE id = ?').run(id)
  changeBus.emit('habits', 'habitCompletions')
}
