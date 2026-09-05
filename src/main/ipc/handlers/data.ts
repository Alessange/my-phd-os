import { statSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { countsOf, defaultBackupFileName } from '@shared/backup/format'
import { AppError } from '@shared/errors'
import { CLEAR_ALL_DATA_CONFIRMATION, type StorageInfo } from '@shared/types/data'
import { clearAllUserData, dataCounts } from '../../database/repositories/maintenance'
import { recordLaunch } from '../../database/repositories/appMeta'
import {
  applyBackup,
  collectBackup,
  currentSchemaVersion,
  readBackupFile,
  registerPreview,
  takePreview,
  writeBackupFile
} from '../../filesystem/backup'
import { pickFiles, pickSavePath } from '../../filesystem/dialogs'
import { logger } from '../../logging/logger'
import type { Handlers } from '../registry'
import { OK } from './shared'

const BACKUP_FILTERS = [{ name: 'JSON backup', extensions: ['json'] }]

const sizeOf = (path: string): number => {
  try {
    return statSync(path).size
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw new AppError('IO', 'Could not read the database file size', { path })
  }
}

export const dataHandlers = {
  'data:exportBackup': async (_request, ctx) => {
    const exportedAt = ctx.now()
    const picked = await pickSavePath(ctx.window, {
      title: 'Export backup',
      filters: BACKUP_FILTERS,
      defaultPath: join(app.getPath('documents'), defaultBackupFileName(exportedAt))
    })
    if (picked.canceled) return { canceled: true }
    const backup = collectBackup(ctx.db, { appVersion: app.getVersion(), exportedAt })
    writeBackupFile(picked.path, backup)
    const counts = countsOf(backup)
    logger.info('[data] exported backup', counts)
    return { canceled: false, path: picked.path, counts }
  },

  'data:previewBackupImport': async (_request, ctx) => {
    const picked = await pickFiles(ctx.window, { title: 'Import backup', filters: BACKUP_FILTERS })
    if (picked.canceled) return { canceled: true }
    const result = readBackupFile(picked.paths[0], currentSchemaVersion(ctx.db))
    if (!result.ok) throw new AppError(result.code, result.message)
    const { backup, warnings } = result
    return {
      canceled: false,
      previewToken: registerPreview(backup),
      summary: {
        formatVersion: backup.formatVersion,
        exportedAt: backup.exportedAt,
        appVersion: backup.appVersion,
        counts: countsOf(backup),
        warnings
      }
    }
  },

  'data:commitBackupImport': ({ previewToken, mode }, ctx) => {
    const backup = takePreview(previewToken)
    if (!backup) {
      throw new AppError(
        'NOT_FOUND',
        'The import preview has expired. Choose the backup file again.'
      )
    }
    const imported = applyBackup(ctx.db, backup, mode)
    logger.info(`[data] imported backup (${mode})`, imported)
    return { imported }
  },

  'data:clearAllData': ({ confirmation }, ctx) => {
    if (confirmation !== CLEAR_ALL_DATA_CONFIRMATION) {
      throw new AppError('VALIDATION', `Type "${CLEAR_ALL_DATA_CONFIRMATION}" to confirm`)
    }
    const before = dataCounts(ctx.db)
    clearAllUserData(ctx.db)
    recordLaunch(ctx.db, app.getVersion(), ctx.now())
    logger.info('[data] cleared all user data', before)
    return OK
  },

  'data:getStorageInfo': (_request, ctx): StorageInfo => ({
    databasePath: ctx.paths.databasePath,
    databaseSizeBytes: sizeOf(ctx.paths.databasePath) + sizeOf(`${ctx.paths.databasePath}-wal`),
    userDataPath: ctx.paths.userData,
    logPath: ctx.paths.logPath,
    counts: dataCounts(ctx.db)
  })
} satisfies Partial<Handlers>
