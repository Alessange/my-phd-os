import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { AppError } from '@shared/errors'

export const DATABASE_FILE_NAME = 'my-phd-os.sqlite'

/**
 * Opens (creating if needed) the on-disk SQLite database and applies the connection PRAGMAs.
 * Throws `AppError('IO')` when the file cannot be opened; never removes an existing file.
 */
export const openDatabase = (path: string): DatabaseSync => {
  try {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    const db = new DatabaseSync(path, { timeout: 5000 })
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA foreign_keys = ON')
    db.exec('PRAGMA busy_timeout = 5000')
    db.exec('PRAGMA synchronous = NORMAL')
    return db
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(
      'IO',
      `Could not open the database: ${error instanceof Error ? error.message : String(error)}`,
      { path }
    )
  }
}

export const closeDatabase = (db: DatabaseSync | null | undefined): void => {
  if (db?.isOpen) db.close()
}

/** Runs `fn` inside a transaction; rolls back and rethrows on failure. */
export const transaction = <T>(db: DatabaseSync, fn: () => T): T => {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
