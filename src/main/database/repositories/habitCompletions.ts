import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type { HabitCompletion } from '@shared/types/habit'
import { changeBus } from '../changeBus'
import { bool, newId, notFound, prepared, str, toInt, type Row } from './shared'
import { getHabit } from './habits'

const COLUMNS = 'id, habit_id, date, completed'

export const rowToHabitCompletion = (row: Row): HabitCompletion => ({
  id: str(row.id),
  habitId: str(row.habit_id),
  date: str(row.date),
  completed: bool(row.completed)
})

export interface ListCompletionsOptions {
  from: string
  to: string
  habitId?: string
}

/** Completions with `from <= date <= to` (inclusive, `YYYY-MM-DD` strings). */
export const listCompletions = (
  db: DatabaseSync,
  options: ListCompletionsOptions
): HabitCompletion[] => {
  const params: SQLInputValue[] = [options.from, options.to]
  let sql = `SELECT ${COLUMNS} FROM habit_completions WHERE date >= ? AND date <= ?`
  if (options.habitId) {
    sql += ' AND habit_id = ?'
    params.push(options.habitId)
  }
  return prepared(db, `${sql} ORDER BY date, habit_id`)
    .all(...params)
    .map(rowToHabitCompletion)
}

export const findCompletion = (
  db: DatabaseSync,
  habitId: string,
  date: string
): HabitCompletion | undefined => {
  const row = prepared(
    db,
    `SELECT ${COLUMNS} FROM habit_completions WHERE habit_id = ? AND date = ?`
  ).get(habitId, date)
  return row ? rowToHabitCompletion(row) : undefined
}

/** Upserts the completion for one habit on one local date. */
export const setCompletion = (
  db: DatabaseSync,
  habitId: string,
  date: string,
  completed: boolean
): HabitCompletion => {
  getHabit(db, habitId)
  prepared(
    db,
    `INSERT INTO habit_completions (${COLUMNS}) VALUES (?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO UPDATE SET completed = excluded.completed`
  ).run(newId(), habitId, date, toInt(completed))
  changeBus.emit('habitCompletions')
  const completion = findCompletion(db, habitId, date)
  if (!completion) throw notFound('Habit completion', `${habitId}@${date}`)
  return completion
}
