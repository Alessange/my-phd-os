import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { app, BrowserWindow, session } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { AppError, toIpcError, type IpcError } from '@shared/errors'
import { channels } from '@shared/ipc/contract'
import type { EventName, EventPayload } from '@shared/ipc/events'
import { changeBus } from './database/changeBus'
import { closeDatabase, openDatabase } from './database/connection'
import { runMigrations } from './database/migrate'
import { recordLaunch } from './database/repositories/appMeta'
import { ignoredRendererUrlReason, isDev, isE2E, rendererDevUrl, userDataOverride } from './env'
import { getDataPaths, type DataPaths } from './filesystem/dataDirectory'
import { handlers } from './ipc/handlers'
import { registerHandlers, type HandlerContext } from './ipc/registry'
import { initLogger, logAppError, logger } from './logging/logger'
import { installAppMenu } from './menu/appMenu'
import { scheduler } from './subscriptions/scheduler'
import { installContentSecurityPolicy } from './security/csp'
import { installNavigationGuards } from './security/navigation'
import { installPermissionPolicy } from './security/permissions'
import { attachWindowStatePersistence, createMainWindow } from './windows/mainWindow'

if (userDataOverride) app.setPath('userData', userDataOverride)

const RENDERER_ROOT = join(__dirname, '../renderer')
const RENDERER_INDEX = join(RENDERER_ROOT, 'index.html')

let mainWindow: BrowserWindow | null = null
let db: DatabaseSync | null = null
let dbError: IpcError | undefined
let paths: DataPaths

const focusedOrMainWindow = (): BrowserWindow | null =>
  BrowserWindow.getFocusedWindow() ?? (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null)

const sendToWindow = <E extends EventName>(
  window: BrowserWindow | null,
  event: E,
  payload: EventPayload<E>
): void => {
  if (window && !window.isDestroyed()) window.webContents.send(event, payload)
}

const broadcast = <E extends EventName>(event: E, payload: EventPayload<E>): void => {
  for (const window of BrowserWindow.getAllWindows()) sendToWindow(window, event, payload)
}

/**
 * Opens and migrates the database. On failure the app keeps running with `dbError` set; the
 * renderer's database screen can call `app:retryDatabase`, which runs this again.
 */
const openStorage = (scope: 'db.startup' | 'db.retry'): void => {
  if (db) return
  try {
    const connection = openDatabase(paths.databasePath)
    try {
      const result = runMigrations(connection)
      if (result.applied.length) {
        logger.info('[db] applied migrations', { versions: result.applied.join(',') })
      }
      recordLaunch(connection, app.getVersion(), new Date().toISOString())
      db = connection
      dbError = undefined
      if (scope === 'db.retry') {
        logger.info('[db] database opened after retry')
        if (mainWindow) attachWindowStatePersistence(mainWindow, db)
      }
    } catch (error) {
      closeDatabase(connection)
      throw error
    }
  } catch (error) {
    dbError = toIpcError(error)
    logAppError(scope, error)
    logger.error(
      '[db] the database was left untouched; the renderer shows a blocking error screen',
      {
        path: paths.databasePath
      }
    )
  }
}

const createContext = (): HandlerContext => ({
  get db(): DatabaseSync {
    if (!db) {
      const error = dbError ?? { code: 'IO', message: 'The database is not available' }
      throw new AppError(error.code, error.message, error.details)
    }
    return db
  },
  get window(): BrowserWindow | null {
    return focusedOrMainWindow()
  },
  paths,
  get dbError(): IpcError | undefined {
    return dbError
  },
  reopenDatabase: () => openStorage('db.retry'),
  now: () => new Date().toISOString()
})

const createWindow = (): void => {
  mainWindow = createMainWindow({
    db,
    rendererUrl: isDev ? rendererDevUrl : undefined,
    rendererIndex: RENDERER_INDEX,
    dbError: dbError !== undefined,
    dev: isDev,
    icon
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const bootstrap = async (): Promise<void> => {
  paths = getDataPaths()
  initLogger({ logsDir: paths.logsDir, console: isDev })
  logger.info('[app] starting', {
    version: app.getVersion(),
    electron: process.versions.electron,
    dev: isDev,
    e2e: isE2E,
    packaged: app.isPackaged
  })
  if (ignoredRendererUrlReason) {
    logger.warn('[app] ELECTRON_RENDERER_URL ignored', { reason: ignoredRendererUrlReason })
  }
  if (userDataOverride) logger.info('[app] userData overridden by MY_PHD_OS_USER_DATA')

  installNavigationGuards({
    devServerUrl: isDev ? rendererDevUrl : undefined,
    rendererRoot: RENDERER_ROOT
  })

  await app.whenReady()
  electronApp.setAppUserModelId('com.myphdos.app')
  installContentSecurityPolicy(session.defaultSession, isDev)
  installPermissionPolicy(session.defaultSession)

  openStorage('db.startup')
  registerHandlers(channels, handlers, createContext)
  changeBus.subscribe((payload) => broadcast('data:changed', payload))

  installAppMenu({
    dev: isDev,
    actions: {
      sendCommand: (command, args) =>
        sendToWindow(focusedOrMainWindow(), 'app:command', args ? { command, args } : { command }),
      navigate: (page, params) =>
        sendToWindow(focusedOrMainWindow(), 'app:navigate', params ? { page, params } : { page })
    }
  })

  createWindow()

  // Conference subscriptions: refresh on launch when stale (honouring `settings.refreshOnLaunch`)
  // plus a periodic check; E2E runs never touch the network.
  if (isE2E) logger.info('[app] E2E mode: startup subscription refresh disabled')
  scheduler.configure({
    getDb: () => db,
    disabled: isE2E,
    onStatus: (status) => broadcast('conferences:refreshStatus', status),
    log: (level, message, details) => logger[level](`[subscriptions] ${message}`, details ?? '')
  })
  scheduler.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = focusedOrMainWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    scheduler.stop()
    changeBus.flush()
    closeDatabase(db)
    db = null
    logger.info('[app] quit')
  })

  bootstrap().catch((error) => {
    logAppError('app.bootstrap', error)
    app.quit()
  })
}
