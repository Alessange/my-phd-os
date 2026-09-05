import type { DatabaseSync } from 'node:sqlite'
import { AppError } from '@shared/errors'
import { migrations as allMigrations, type Migration } from './migrations'

export interface MigrationResult {
  applied: number[]
  currentVersion: number
}

const ensureMigrationsTable = (db: DatabaseSync): void => {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)'
  )
}

export const appliedVersions = (db: DatabaseSync): number[] => {
  ensureMigrationsTable(db)
  return db
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all()
    .map((row) => Number(row.version))
}

/**
 * Applies every pending migration in ascending version order, each inside its own transaction.
 * A failing migration is rolled back and reported as `AppError('MIGRATION_FAILED')`; the database
 * file is never deleted or recreated.
 */
export const runMigrations = (
  db: DatabaseSync,
  migrations: readonly Migration[] = allMigrations
): MigrationResult => {
  const ordered = [...migrations].sort((a, b) => a.version - b.version)
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].version === ordered[i - 1].version) {
      throw new AppError('MIGRATION_FAILED', 'Duplicate migration version', {
        version: ordered[i].version
      })
    }
  }

  const done = new Set(appliedVersions(db))
  const applied: number[] = []
  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  )

  for (const migration of ordered) {
    if (done.has(migration.version)) continue
    db.exec('BEGIN')
    try {
      db.exec(migration.sql)
      insert.run(migration.version, migration.name, new Date().toISOString())
      db.exec('COMMIT')
      applied.push(migration.version)
    } catch (error) {
      db.exec('ROLLBACK')
      throw new AppError(
        'MIGRATION_FAILED',
        `Database migration ${migration.version} (${migration.name}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { version: migration.version, name: migration.name }
      )
    }
  }

  const currentVersion = Math.max(0, ...done, ...applied)
  return { applied, currentVersion }
}
