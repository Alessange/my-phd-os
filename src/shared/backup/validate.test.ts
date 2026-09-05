import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, countsOf, defaultBackupFileName } from './format'
import { validateBackup } from './validate'

const valid = {
  format: BACKUP_FORMAT,
  formatVersion: BACKUP_FORMAT_VERSION,
  schemaVersion: 1,
  appVersion: '0.1.0',
  exportedAt: '2026-09-05T10:00:00.000Z',
  tables: {
    habits: [
      { id: 'h1', name: 'Read', color: '#fff', frequency_json: '{"type":"daily"}', created_at: 'x' }
    ],
    milestones: []
  }
}

describe('validateBackup', () => {
  it('accepts a well-formed backup and reports no warnings', () => {
    const result = validateBackup(valid, 1)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.warnings).toEqual([])
      expect(result.backup.tables.habits).toHaveLength(1)
    }
  })

  it('rejects files that are not a backup', () => {
    expect(validateBackup({ hello: 'world' }, 1)).toMatchObject({
      ok: false,
      code: 'INVALID_BACKUP'
    })
    expect(validateBackup('text', 1)).toMatchObject({ ok: false, code: 'INVALID_BACKUP' })
    expect(validateBackup({ ...valid, format: 'other' }, 1)).toMatchObject({
      ok: false,
      code: 'INVALID_BACKUP'
    })
    expect(
      validateBackup({ ...valid, tables: { habits: [{ id: { nested: true } }] } }, 1)
    ).toMatchObject({ ok: false, code: 'INVALID_BACKUP' })
  })

  it('rejects unsupported format versions and newer schemas', () => {
    expect(validateBackup({ ...valid, formatVersion: 99 }, 1)).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_BACKUP_VERSION'
    })
    expect(validateBackup({ ...valid, schemaVersion: 5 }, 1)).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_BACKUP_VERSION'
    })
  })

  it('ignores unknown tables and flags older schemas as warnings', () => {
    const result = validateBackup(
      {
        ...valid,
        schemaVersion: 1,
        tables: { ...valid.tables, app_meta: [{ key: 'x', value: 'y' }] }
      },
      2
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.backup.tables).not.toHaveProperty('app_meta')
      expect(result.warnings).toHaveLength(2)
      expect(result.warnings[0]).toMatch(/unknown table "app_meta"/)
      expect(result.warnings[1]).toMatch(/older database version/)
    }
  })
})

describe('countsOf / defaultBackupFileName', () => {
  it('counts rows per entity, zero for absent tables', () => {
    const counts = countsOf(valid)
    expect(counts.habits).toBe(1)
    expect(counts.milestones).toBe(0)
    expect(counts.calendarEvents).toBe(0)
  })

  it('names the file by export date', () => {
    expect(defaultBackupFileName('2026-09-05T10:00:00.000Z')).toBe(
      'my-phd-os-backup-2026-09-05.json'
    )
  })
})
