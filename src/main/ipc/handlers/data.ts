import { statSync } from 'node:fs'
import { app } from 'electron'
import { AppError } from '@shared/errors'
import { CLEAR_ALL_DATA_CONFIRMATION, type StorageInfo } from '@shared/types/data'
import { clearAllUserData, dataCounts } from '../../database/repositories/maintenance'
import { recordLaunch } from '../../database/repositories/appMeta'
import { logger } from '../../logging/logger'
import type { Handlers } from '../registry'
import { OK, notImplemented } from './shared'

const sizeOf = (path: string): number => {
  try {
    return statSync(path).size
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw new AppError('IO', 'Could not read the database file size', { path })
  }
}

export const dataHandlers = {
  // Owned by the settings-data feature agent (src/main/filesystem/backup.ts + src/shared/backup).
  'data:exportBackup': () => notImplemented('Backup export'),
  'data:previewBackupImport': () => notImplemented('Backup import preview'),
  'data:commitBackupImport': () => notImplemented('Backup import'),

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
