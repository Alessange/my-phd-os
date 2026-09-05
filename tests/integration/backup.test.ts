import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, ENTITY_TABLES } from '../../src/shared/backup/format'
import { changeBus } from '../../src/main/database/changeBus'
import { closeDatabase, openDatabase } from '../../src/main/database/connection'
import { runMigrations } from '../../src/main/database/migrate'
import * as events from '../../src/main/database/repositories/calendarEvents'
import * as completions from '../../src/main/database/repositories/habitCompletions'
import * as habits from '../../src/main/database/repositories/habits'
import {
  ENTITY_TABLES as MAINTENANCE_ENTITY_TABLES,
  clearAllUserData,
  dataCounts
} from '../../src/main/database/repositories/maintenance'
import * as milestones from '../../src/main/database/repositories/milestones'
import * as personal from '../../src/main/database/repositories/personalDeadlines'
import * as settings from '../../src/main/database/repositories/settings'
import * as warnings from '../../src/main/database/repositories/dismissedWarnings'
import {
  PREVIEW_TTL_MS,
  applyBackup,
  collectBackup,
  currentSchemaVersion,
  readBackupFile,
  registerPreview,
  takePreview,
  writeBackupFile
} from '../../src/main/filesystem/backup'
import { personalDeadlineHandlers } from '../../src/main/ipc/handlers/personalDeadlines'
import type { HandlerContext } from '../../src/main/ipc/registry'

let dir: string
let db: DatabaseSync
let ctx: HandlerContext

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'my-phd-os-backup-'))
  db = openDatabase(join(dir, 'test.sqlite'))
  runMigrations(db)
  ctx = { db, now: () => new Date().toISOString() } as unknown as HandlerContext
})

afterAll(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  clearAllUserData(db)
  changeBus.flush()
})

/** A small but fully cross-linked data set: deadline ↔ event cycle, deadline → milestone, habit → completion. */
const seed = (): { deadlineId: string; eventId: string; milestoneId: string; habitId: string } => {
  const milestone = milestones.createMilestone(db, {
    title: 'Thesis proposal',
    startAt: '2026-09-01T00:00:00Z',
    targetAt: '2026-12-01T00:00:00Z',
    category: 'phd_progress',
    status: 'in_progress',
    progress: 10
  })
  const deadline = personal.createPersonalDeadline(db, {
    title: 'Submit proposal draft',
    trackingStartAt: '2026-09-01T00:00:00Z',
    deadlineAt: '2026-10-01T12:00:00Z',
    timezone: 'America/Vancouver',
    category: 'academic',
    priority: 'high',
    status: 'in_progress',
    progress: 40,
    tags: ['thesis'],
    linkedMilestoneId: milestone.id
  })
  const { event } = personalDeadlineHandlers['personalDeadlines:linkCalendarEvent'](
    { id: deadline.id, mode: 'allDay' },
    ctx
  )
  const habit = habits.createHabit(db, {
    name: 'Read',
    color: '#3b82f6',
    frequency: { type: 'daily' }
  })
  completions.setCompletion(db, habit.id, '2026-09-04', true)
  settings.patchSettings(db, { theme: 'dark', weekStartsOn: 0 })
  settings.patchUiState(db, { timelineView: 'list' })
  settings.setWindowState(db, { x: 1, y: 2, width: 1200, height: 800, isMaximized: false })
  warnings.dismissWarning(db, 'start_after_target:m1', { rule: 'start_after_target' })
  return {
    deadlineId: deadline.id,
    eventId: event.id,
    milestoneId: milestone.id,
    habitId: habit.id
  }
}

describe('JSON backup (spec §17, §25)', () => {
  it('keeps one entity → table map between shared and main', () => {
    expect(MAINTENANCE_ENTITY_TABLES).toEqual(ENTITY_TABLES)
  })

  it('exports every user table, excluding window bounds and app_meta, and round-trips through a file', () => {
    seed()
    const backup = collectBackup(db, {
      appVersion: '0.1.0',
      exportedAt: '2026-09-05T10:00:00.000Z'
    })
    expect(backup).toMatchObject({
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: currentSchemaVersion(db),
      appVersion: '0.1.0'
    })
    expect(backup.tables.settings?.map((row) => row.key).sort()).toEqual(['app', 'ui'].sort())
    expect(backup.tables).not.toHaveProperty('app_meta')
    expect(backup.tables.personal_deadlines).toHaveLength(1)
    expect(backup.tables.calendar_events).toHaveLength(1)

    const path = join(dir, 'roundtrip.json')
    writeBackupFile(path, backup)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(backup)
    const read = readBackupFile(path, currentSchemaVersion(db))
    expect(read.ok).toBe(true)
    if (read.ok) expect(read.backup).toEqual(backup)
  })

  it('restores a backup with replace, preserving ids, cross-links, settings and the window bounds', () => {
    const ids = seed()
    const backup = collectBackup(db, {
      appVersion: '0.1.0',
      exportedAt: '2026-09-05T10:00:00.000Z'
    })
    const before = dataCounts(db)

    clearAllUserData(db)
    expect(dataCounts(db).personalDeadlines).toBe(0)
    settings.setWindowState(db, { x: 9, y: 9, width: 900, height: 700, isMaximized: true })

    const imported = applyBackup(db, backup, 'replace')
    expect(imported).toEqual(before)
    expect(dataCounts(db)).toEqual(before)

    const deadline = personal.getPersonalDeadline(db, ids.deadlineId)
    expect(deadline.linkedCalendarEventId).toBe(ids.eventId)
    expect(deadline.linkedMilestoneId).toBe(ids.milestoneId)
    expect(deadline.tags).toEqual(['thesis'])
    expect(events.getEvent(db, ids.eventId).linkedPersonalDeadlineId).toBe(ids.deadlineId)
    expect(completions.listCompletions(db, { from: '2026-09-01', to: '2026-09-30' })).toHaveLength(
      1
    )
    expect(settings.getSettings(db)).toMatchObject({ theme: 'dark', weekStartsOn: 0 })
    expect(settings.getUiState(db).timelineView).toBe('list')
    // Device-specific window bounds are not part of a backup.
    expect(settings.getWindowState(db)).toMatchObject({ x: 9, y: 9, isMaximized: true })
    expect(warnings.listDismissedWarnings(db)).toHaveLength(1)
  })

  it('merges a backup: same ids are updated, new rows added, other rows kept', () => {
    const ids = seed()
    const backup = collectBackup(db, {
      appVersion: '0.1.0',
      exportedAt: '2026-09-05T10:00:00.000Z'
    })
    // Change the live copy after the export, and add a row the backup does not know.
    milestones.updateMilestone(db, ids.milestoneId, { title: 'Renamed locally', progress: 80 })
    const extra = habits.createHabit(db, {
      name: 'Run',
      color: '#22c55e',
      frequency: { type: 'daily' }
    })

    applyBackup(db, backup, 'merge')
    expect(milestones.getMilestone(db, ids.milestoneId)).toMatchObject({
      title: 'Thesis proposal',
      progress: 10
    })
    expect(habits.getHabit(db, extra.id).name).toBe('Run')
    expect(habits.listHabits(db, { includeArchived: true })).toHaveLength(2)
  })

  it('rejects invalid files before touching the database and rolls back a failing import', () => {
    const invalidJson = join(dir, 'broken.json')
    writeFileSync(invalidJson, '{ not json', 'utf8')
    expect(readBackupFile(invalidJson, 1)).toMatchObject({ ok: false, code: 'INVALID_BACKUP' })

    const foreign = join(dir, 'foreign.json')
    writeFileSync(foreign, JSON.stringify({ hello: 'world' }), 'utf8')
    expect(readBackupFile(foreign, 1)).toMatchObject({ ok: false, code: 'INVALID_BACKUP' })

    const newer = join(dir, 'newer.json')
    writeFileSync(
      newer,
      JSON.stringify({
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION + 1,
        schemaVersion: 1,
        appVersion: '9.9.9',
        exportedAt: '2026-09-05T10:00:00.000Z',
        tables: {}
      }),
      'utf8'
    )
    expect(readBackupFile(newer, 1)).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_BACKUP_VERSION'
    })

    // A row violating the schema (unknown column) aborts the whole import; existing data survives.
    seed()
    const before = dataCounts(db)
    const bad = collectBackup(db, { appVersion: '0.1.0', exportedAt: '2026-09-05T10:00:00.000Z' })
    bad.tables.habits = [
      { id: 'h-bad', name: 'x', color: '#fff', frequency_json: '{}', created_at: 'now', bogus: 1 }
    ]
    expect(() => applyBackup(db, bad, 'replace')).toThrowError(
      expect.objectContaining({ code: 'INVALID_BACKUP' })
    )
    expect(dataCounts(db)).toEqual(before)
  })

  it('hands a preview to commit exactly once and expires it', () => {
    const backup = collectBackup(db, {
      appVersion: '0.1.0',
      exportedAt: '2026-09-05T10:00:00.000Z'
    })
    const token = registerPreview(backup, 1_000)
    expect(takePreview(token, 2_000)).toEqual(backup)
    expect(takePreview(token, 2_000)).toBeUndefined()
    const stale = registerPreview(backup, 1_000)
    expect(takePreview(stale, 1_000 + PREVIEW_TTL_MS + 1)).toBeUndefined()
  })
})
