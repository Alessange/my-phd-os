import { z } from 'zod'
import type { AppErrorCode } from '../types/common'
import { isoInstantSchema } from '../schemas/common'
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  isBackupTableName,
  type BackupFile,
  type BackupRow
} from './format'

const cellSchema = z.union([z.string(), z.number(), z.null()])
const rowSchema = z.record(z.string().min(1).max(200), cellSchema)

const envelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  appVersion: z.string().max(100),
  exportedAt: isoInstantSchema,
  tables: z.record(z.string(), z.array(rowSchema))
})

export type BackupValidation =
  | { ok: true; backup: BackupFile; warnings: string[] }
  | {
      ok: false
      code: Extract<AppErrorCode, 'INVALID_BACKUP' | 'UNSUPPORTED_BACKUP_VERSION'>
      message: string
    }

/**
 * Validates parsed JSON as a backup before anything touches the database (spec §17: every import
 * shows a preview first). Rejects foreign files and newer formats or schemas; tolerates older
 * schemas (missing columns take defaults) and ignores unknown tables, both reported as warnings.
 */
export const validateBackup = (raw: unknown, currentSchemaVersion: number): BackupValidation => {
  const parsed = envelopeSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first?.path.length ? ` (${first.path.join('.')})` : ''
    return {
      ok: false,
      code: 'INVALID_BACKUP',
      message: `This file is not a My PhD OS backup${where}: ${first?.message ?? 'unexpected shape'}`
    }
  }
  const { formatVersion, schemaVersion } = parsed.data
  if (formatVersion !== BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      code: 'UNSUPPORTED_BACKUP_VERSION',
      message: `Backup format v${formatVersion} is not supported by this version (expects v${BACKUP_FORMAT_VERSION})`
    }
  }
  if (schemaVersion > currentSchemaVersion) {
    return {
      ok: false,
      code: 'UNSUPPORTED_BACKUP_VERSION',
      message: `This backup was written by a newer version of the app (database schema ${schemaVersion}, this app has ${currentSchemaVersion}). Update the app to import it.`
    }
  }

  const warnings: string[] = []
  const tables: BackupFile['tables'] = {}
  for (const [name, rows] of Object.entries(parsed.data.tables)) {
    if (isBackupTableName(name)) tables[name] = rows as BackupRow[]
    else warnings.push(`Ignored unknown table "${name}" (${rows.length} rows)`)
  }
  if (schemaVersion < currentSchemaVersion) {
    warnings.push(
      `Backup from an older database version (${schemaVersion} < ${currentSchemaVersion}); fields added since then take their defaults`
    )
  }
  return { ok: true, backup: { ...parsed.data, format: BACKUP_FORMAT, tables }, warnings }
}
