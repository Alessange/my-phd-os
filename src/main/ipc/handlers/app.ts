import { app } from 'electron'
import type { AppInfo } from '@shared/types/app'
import { openDataDirectory } from '../../filesystem/dataDirectory'
import { logger, sanitizeRendererContext } from '../../logging/logger'
import { openExternalUrl } from '../../security/openExternal'
import type { HandlerContext, Handlers } from '../registry'
import { OK } from './shared'

const buildAppInfo = (ctx: HandlerContext): AppInfo => ({
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
})

export const appHandlers = {
  'app:getInfo': (_request, ctx): AppInfo => buildAppInfo(ctx),

  /**
   * Re-attempts opening + migrating the database after a startup failure (the blocking database
   * screen's Retry). Returns the same shape as `app:getInfo`; `dbError` is absent on success.
   */
  'app:retryDatabase': (_request, ctx): AppInfo => {
    ctx.reopenDatabase()
    return buildAppInfo(ctx)
  },
  'app:openExternal': async ({ url }) => {
    await openExternalUrl(url)
    return OK
  },

  'app:openDataDirectory': async (_request, ctx) => {
    await openDataDirectory(ctx.paths)
    return OK
  },

  /**
   * Renderer-side log line. The schema admits only bounded primitive context and main truncates
   * it again (`sanitizeRendererContext`); the renderer still must not put personal content in it.
   */
  'app:log': ({ level, message, context }) => {
    logger[level](`[renderer] ${message}`, sanitizeRendererContext(context) ?? '')
    return OK
  }
} satisfies Partial<Handlers>
