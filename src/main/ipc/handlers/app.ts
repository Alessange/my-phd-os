import { app } from 'electron'
import type { AppInfo } from '@shared/types/app'
import { openDataDirectory } from '../../filesystem/dataDirectory'
import { logger } from '../../logging/logger'
import { openExternalUrl } from '../../security/openExternal'
import type { Handlers } from '../registry'
import { OK } from './shared'

export const appHandlers = {
  'app:getInfo': (_request, ctx): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron ?? '',
    node: process.versions.node,
    chrome: process.versions.chrome ?? '',
    userDataPath: ctx.paths.userData,
    databasePath: ctx.paths.databasePath,
    logPath: ctx.paths.logPath,
    systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isPackaged: app.isPackaged,
    ...(ctx.dbError ? { dbError: ctx.dbError } : {})
  }),

  'app:openExternal': async ({ url }) => {
    await openExternalUrl(url)
    return OK
  },

  'app:openDataDirectory': async (_request, ctx) => {
    await openDataDirectory(ctx.paths)
    return OK
  },

  /** Renderer-side log line. The renderer is responsible for not including personal content. */
  'app:log': ({ level, message, context }) => {
    logger[level](`[renderer] ${message}`, context ?? '')
    return OK
  }
} satisfies Partial<Handlers>
