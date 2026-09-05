import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { closeDatabase, openDatabase } from '../../../src/main/database/connection'
import { appliedVersions, runMigrations } from '../../../src/main/database/migrate'
import { migrations } from '../../../src/main/database/migrations'
import type { Migration } from '../../../src/main/database/migrations'

let db: DatabaseSync

const tables = (): string[] =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => String(row.name))

beforeEach(() => {
  db = openDatabase(':memory:')
})

afterEach(() => {
  closeDatabase(db)
})

describe('runMigrations failure paths', () => {
  it('rolls back a failing migration, leaves schema_migrations and existing tables intact', () => {
    const baseline = runMigrations(db)
    expect(baseline.applied).toEqual(migrations.map((m) => m.version))
    const before = tables()

    const bad: Migration = {
      version: 999,
      name: 'bad',
      sql: 'CREATE TABLE will_roll_back (id TEXT PRIMARY KEY); CREATE TABLE broken ('
    }
    let thrown: unknown
    try {
      runMigrations(db, [...migrations, bad])
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({
      code: 'MIGRATION_FAILED',
      details: { version: 999, name: 'bad' }
    })
    expect(String((thrown as Error).message)).toMatch(/migration 999 \(bad\) failed/)
    expect(appliedVersions(db)).toEqual(migrations.map((m) => m.version))
    expect(tables()).toEqual(before)
    expect(tables()).not.toContain('will_roll_back')
    // The connection is usable afterwards (no dangling transaction).
    expect(runMigrations(db).applied).toEqual([])
  })

  it('applies pending migrations after the last applied one and reports currentVersion', () => {
    runMigrations(db)
    const extra: Migration = {
      version: 998,
      name: 'extra',
      sql: 'CREATE TABLE extra_table (id TEXT PRIMARY KEY)'
    }
    const result = runMigrations(db, [...migrations, extra])
    expect(result).toEqual({ applied: [998], currentVersion: 998 })
    expect(tables()).toContain('extra_table')
    expect(runMigrations(db, [...migrations, extra]).applied).toEqual([])
  })

  it('refuses a migration list with duplicate versions before touching the database', () => {
    const dup: Migration = { version: 1, name: 'dup', sql: 'CREATE TABLE dup (id TEXT)' }
    expect(() => runMigrations(db, [...migrations, dup])).toThrowError(
      expect.objectContaining({ code: 'MIGRATION_FAILED', details: { version: 1 } })
    )
    expect(appliedVersions(db)).toEqual([])
    expect(tables()).not.toContain('dup')
  })
})
