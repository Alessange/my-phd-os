import { join } from 'node:path'
import { app, shell } from 'electron'
import { AppError } from '@shared/errors'
import { DATABASE_FILE_NAME } from '../database/connection'
import { logPathFor } from '../logging/logger'

export interface DataPaths {
  userData: string
  databasePath: string
  logsDir: string
  logPath: string
}

/** All on-disk locations derive from `app.getPath('userData')` (ARCHITECTURE §0.5). */
export const getDataPaths = (): DataPaths => {
  const userData = app.getPath('userData')
  const logsDir = join(userData, 'logs')
  return {
    userData,
    databasePath: join(userData, DATABASE_FILE_NAME),
    logsDir,
    logPath: logPathFor(logsDir)
  }
}

/** Reveals the data directory in the native file manager. */
export const openDataDirectory = async (paths: DataPaths): Promise<void> => {
  const failure = await shell.openPath(paths.userData)
  if (failure) {
    throw new AppError('IO', `Could not open the data directory: ${failure}`, {
      path: paths.userData
    })
  }
}
