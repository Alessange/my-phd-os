import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parseIcsFiles } from '../../src/shared/ics/parse'
import { changeBus } from '../../src/main/database/changeBus'
import { closeDatabase, openDatabase } from '../../src/main/database/connection'
import { runMigrations } from '../../src/main/database/migrate'
import * as events from '../../src/main/database/repositories/calendarEvents'
import * as sources from '../../src/main/database/repositories/calendarSources'
import { clearAllUserData } from '../../src/main/database/repositories/maintenance'
import {
  buildExport,
  buildImportPreview,
  commitImport,
  takeImportPreview
} from '../../src/main/filesystem/icsImport'

const FIXTURES = join(__dirname, '../fixtures/ics')
const file = (name: string): { name: string; text: string } => ({
  name,
  text: readFileSync(join(FIXTURES, name), 'utf8')
})
const ZONE = 'America/Vancouver'

let dir: string
let db: DatabaseSync

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'my-phd-os-ics-'))
  db = openDatabase(join(dir, 'test.sqlite'))
  runMigrations(db)
})

afterAll(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  clearAllUserData(db)
  changeBus.flush()
})

const importGoogle = (): ReturnType<typeof commitImport> => {
  const preview = buildImportPreview(db, { files: [file('google-export-sample.ics')] }, ZONE)
  return commitImport(db, {
    previewToken: preview.previewToken,
    conflictPolicy: 'skip',
    source: { mode: 'new', name: 'Google', color: '#3b82f6' }
  })
}

describe('.ics import (spec §10)', () => {
  it('previews without writing: counts, date range, samples, per-file warnings, no conflicts on an empty DB', () => {
    const preview = buildImportPreview(
      db,
      { files: [file('google-export-sample.ics'), file('partially-invalid.ics')] },
      ZONE
    )
    expect(preview.files.map((f) => f.name)).toEqual([
      'google-export-sample.ics',
      'partially-invalid.ics'
    ])
    const google = preview.files[0]
    const partial = preview.files[1]
    expect(google.eventCount).toBeGreaterThanOrEqual(5)
    expect(partial.eventCount).toBe(2)
    expect(partial.warnings.some((w) => w.includes('no DTSTART'))).toBe(true)
    expect(preview.recognizedEvents).toBe(google.eventCount + partial.eventCount)
    expect(preview.dateRange?.start).toBe('2026-09-08T17:00:00.000Z')
    expect(preview.sampleEvents.length).toBeLessThanOrEqual(8)
    expect(preview.sampleEvents[0].startAt).toBe('2026-09-08T17:00:00.000Z')
    expect(preview.conflicts).toEqual([])
    expect(preview.invalidFiles).toEqual([])
    expect(events.listEvents(db, { includeHiddenSources: true })).toHaveLength(0)
  })

  it('commits into a new source, linking modified instances to their master and folding cancelled occurrences into EXDATE', () => {
    const result = importGoogle()
    expect(result.imported).toBeGreaterThanOrEqual(5)
    expect(result.skipped).toBe(0)
    const source = sources.getSource(db, result.sourceId)
    expect(source).toMatchObject({
      name: 'Google',
      type: 'imported',
      originalFileName: 'google-export-sample.ics'
    })

    const stored = events.listEvents(db, { includeHiddenSources: true })
    const master = stored.find(
      (e) => e.importedUid === 'fixture-weekly-seminar@example.test' && !e.recurrenceId
    )
    const moved = stored.find(
      (e) => e.importedUid === 'fixture-weekly-seminar@example.test' && e.recurrenceId
    )
    expect(master?.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T075959Z')
    expect(moved?.recurrenceMasterId).toBe(master?.id)
    expect(moved?.sourceCalendarId).toBe(source.id)
    // The fixture's cancelled occurrence (if any) is an EXDATE on the series, never its own event.
    expect(stored.every((e) => !(e.recurrenceId && e.status === 'cancelled'))).toBe(true)
    expect(master?.exdates).toContain('2026-11-24T18:00:00.000Z')
  })

  it('detects the same file again as duplicates by UID and recurrence id, then honours each conflict policy', () => {
    const first = importGoogle()
    const again = buildImportPreview(db, { files: [file('google-export-sample.ics')] }, ZONE)
    expect(again.conflicts.length).toBe(again.recognizedEvents)
    expect(again.conflicts.map((c) => c.reason).sort()).toEqual(
      expect.arrayContaining(['uid', 'recurrenceId'])
    )

    const skipped = commitImport(db, {
      previewToken: again.previewToken,
      conflictPolicy: 'skip',
      source: { mode: 'existing', id: first.sourceId }
    })
    expect(skipped).toMatchObject({ imported: 0, replaced: 0, skipped: again.recognizedEvents })
    expect(events.listEvents(db, { includeHiddenSources: true })).toHaveLength(first.imported)

    const replaced = commitImport(db, {
      previewToken: buildImportPreview(db, { files: [file('google-export-sample.ics')] }, ZONE)
        .previewToken,
      conflictPolicy: 'replace',
      source: { mode: 'existing', id: first.sourceId }
    })
    expect(replaced.replaced).toBe(again.recognizedEvents)
    expect(events.listEvents(db, { includeHiddenSources: true })).toHaveLength(first.imported)

    const both = commitImport(db, {
      previewToken: buildImportPreview(db, { files: [file('google-export-sample.ics')] }, ZONE)
        .previewToken,
      conflictPolicy: 'keepBoth',
      source: { mode: 'existing', id: first.sourceId }
    })
    expect(both.imported).toBe(again.recognizedEvents)
    expect(events.listEvents(db, { includeHiddenSources: true })).toHaveLength(first.imported * 2)
  })

  it('interprets floating times in the app zone and rejects a used or expired preview token', () => {
    const preview = buildImportPreview(db, { files: [file('floating-and-rdate-sample.ics')] }, ZONE)
    const result = commitImport(db, {
      previewToken: preview.previewToken,
      conflictPolicy: 'skip',
      source: { mode: 'new', name: 'Apple', color: '#22c55e' }
    })
    const floating = events
      .listEvents(db, { includeHiddenSources: true })
      .find((e) => e.importedUid === 'fixture-floating-writing@example.test')
    expect(floating).toMatchObject({ startAt: '2026-09-15T16:00:00.000Z', timezone: ZONE })
    expect(result.imported).toBe(4)
    expect(takeImportPreview(preview.previewToken)).toBeUndefined()
    expect(() =>
      commitImport(db, {
        previewToken: preview.previewToken,
        conflictPolicy: 'skip',
        source: { mode: 'existing', id: result.sourceId }
      })
    ).toThrowError(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})

describe('.ics export (spec §10.3)', () => {
  it('exports the whole calendar, one source, a range or selected events, and re-imports cleanly', () => {
    const google = importGoogle()
    const applePreview = buildImportPreview(
      db,
      { files: [file('floating-and-rdate-sample.ics')] },
      ZONE
    )
    const apple = commitImport(db, {
      previewToken: applePreview.previewToken,
      conflictPolicy: 'skip',
      source: { mode: 'new', name: 'Apple Calendar', color: '#22c55e' }
    })
    const total = google.imported + apple.imported
    const now = '2026-09-05T10:00:00.000Z'

    const all = buildExport(db, { type: 'all' }, now)
    expect(all.count).toBe(total)
    expect(all.suggestedName).toBe('my-phd-os-calendar-2026-09-05.ics')

    const oneSource = buildExport(db, { type: 'source', sourceId: apple.sourceId }, now)
    expect(oneSource.count).toBe(apple.imported)
    expect(oneSource.suggestedName).toBe('apple-calendar-2026-09-05.ics')
    expect(oneSource.text).toContain('X-WR-CALNAME:Apple Calendar')

    const range = buildExport(db, { type: 'range', start: '2026-10-11', end: '2026-10-15' }, now)
    expect(range.count).toBeGreaterThan(0)
    expect(range.count).toBeLessThan(total)

    const selected = buildExport(db, { type: 'events', ids: [google.eventIds[0]] }, now)
    expect(selected.count).toBe(1)

    // Export → parse → the same instants, all-day state and recurrence come back.
    const reparsed = parseIcsFiles([{ name: 'export.ics', text: all.text }], { appZone: ZONE })
    expect(reparsed.invalidFiles).toEqual([])
    expect(reparsed.files[0].events).toHaveLength(total)
    const seminar = reparsed.files[0].events.find(
      (e) => e.uid === 'fixture-weekly-seminar@example.test' && !e.recurrenceId
    )
    expect(seminar).toMatchObject({
      startAt: '2026-09-08T17:00:00.000Z',
      timezone: 'America/Los_Angeles',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T075959Z'
    })
    const retreat = reparsed.files[0].events.find(
      (e) => e.uid === 'fixture-allday-retreat@example.test'
    )
    expect(retreat).toMatchObject({ allDay: true, startAt: '2026-10-12', endAt: '2026-10-14' })

    // Re-importing the export into the same source is a full duplicate set.
    const reimport = buildImportPreview(
      db,
      { files: [{ name: 'export.ics', text: all.text }] },
      ZONE
    )
    expect(reimport.conflicts).toHaveLength(total)
  })
})
