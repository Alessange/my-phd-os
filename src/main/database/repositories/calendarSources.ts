import type { DatabaseSync } from 'node:sqlite'
import type { CreateCalendarSourceInput, UpdateCalendarSourceInput } from '@shared/schemas/calendar'
import type { CalendarSource, DeleteCalendarSourceResult } from '@shared/types/calendar'
import { transaction } from '../connection'
import { changeBus } from '../changeBus'
import {
  bool,
  buildSet,
  newId,
  notFound,
  nowIso,
  num,
  optStr,
  orNull,
  prepared,
  str,
  toInt,
  type Row
} from './shared'

const COLUMNS = 'id, name, color, type, original_file_name, imported_at, visible'

export const rowToCalendarSource = (row: Row): CalendarSource => ({
  id: str(row.id),
  name: str(row.name),
  color: str(row.color),
  type: str(row.type) as CalendarSource['type'],
  originalFileName: optStr(row.original_file_name),
  importedAt: str(row.imported_at),
  visible: bool(row.visible)
})

export const listSources = (db: DatabaseSync): CalendarSource[] =>
  prepared(db, `SELECT ${COLUMNS} FROM calendar_sources ORDER BY imported_at, name`)
    .all()
    .map(rowToCalendarSource)

export const findSource = (db: DatabaseSync, id: string): CalendarSource | undefined => {
  const row = prepared(db, `SELECT ${COLUMNS} FROM calendar_sources WHERE id = ?`).get(id)
  return row ? rowToCalendarSource(row) : undefined
}

export const getSource = (db: DatabaseSync, id: string): CalendarSource => {
  const source = findSource(db, id)
  if (!source) throw notFound('Calendar source', id)
  return source
}

type ParsedCreate = Required<Pick<CreateCalendarSourceInput, 'visible'>> &
  Omit<CreateCalendarSourceInput, 'visible'>

export const createSource = (db: DatabaseSync, input: ParsedCreate): CalendarSource => {
  const id = newId()
  prepared(db, `INSERT INTO calendar_sources (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    input.name,
    input.color,
    input.type,
    orNull(input.originalFileName),
    nowIso(),
    toInt(input.visible)
  )
  changeBus.emit('calendarSources')
  return getSource(db, id)
}

export const updateSource = (
  db: DatabaseSync,
  id: string,
  patch: UpdateCalendarSourceInput
): CalendarSource => {
  getSource(db, id)
  const { clause, values } = buildSet({
    name: patch.name,
    color: patch.color,
    type: patch.type,
    original_file_name: patch.originalFileName,
    visible: patch.visible === undefined ? undefined : toInt(patch.visible)
  })
  if (clause) prepared(db, `UPDATE calendar_sources SET ${clause} WHERE id = ?`).run(...values, id)
  changeBus.emit('calendarSources')
  return getSource(db, id)
}

/**
 * Deletes a source. With `deleteEvents` its events are removed too; otherwise they are kept and
 * detached (`sourceCalendarId` cleared). Both paths run in one transaction.
 */
export const deleteSource = (
  db: DatabaseSync,
  id: string,
  deleteEvents: boolean
): DeleteCalendarSourceResult => {
  getSource(db, id)
  const deletedEvents = transaction(db, () => {
    let removed = 0
    if (deleteEvents) {
      removed = num(
        prepared(db, 'DELETE FROM calendar_events WHERE source_calendar_id = ?').run(id).changes
      )
    } else {
      prepared(
        db,
        'UPDATE calendar_events SET source_calendar_id = NULL, updated_at = ? WHERE source_calendar_id = ?'
      ).run(nowIso(), id)
    }
    prepared(db, 'DELETE FROM calendar_sources WHERE id = ?').run(id)
    return removed
  })
  changeBus.emit('calendarSources', 'calendarEvents')
  return { ok: true, deletedEvents }
}
