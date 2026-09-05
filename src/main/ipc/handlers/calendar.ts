import { resolveZone } from '@shared/dates/zones'
import * as events from '../../database/repositories/calendarEvents'
import * as sources from '../../database/repositories/calendarSources'
import { getSettings } from '../../database/repositories/settings'
import { buildExport, buildImportPreview, commitImport } from '../../filesystem/icsImport'
import { pickIcsFiles, saveIcsFile } from '../../filesystem/icsFiles'
import { logger } from '../../logging/logger'
import type { Handlers } from '../registry'
import { OK } from './shared'

/** Floating `.ics` times are interpreted in the application zone at import time (ARCHITECTURE §8). */
const importZone = (timezone: string): string =>
  timezone === 'system' ? (resolveZone('system').ianaName ?? 'UTC') : timezone

export const calendarHandlers = {
  'calendar:listEvents': (filter, ctx) => events.listEvents(ctx.db, filter),
  'calendar:getEvent': ({ id }, ctx) => events.getEvent(ctx.db, id),
  'calendar:createEvent': (input, ctx) => events.createEvent(ctx.db, input),
  'calendar:updateEvent': ({ id, patch }, ctx) => events.updateEvent(ctx.db, id, patch),
  'calendar:deleteEvent': ({ id }, ctx) => {
    events.deleteEvent(ctx.db, id)
    return OK
  },

  'calendar:listSources': (_request, ctx) => sources.listSources(ctx.db),
  'calendar:createSource': (input, ctx) => sources.createSource(ctx.db, input),
  'calendar:updateSource': ({ id, patch }, ctx) => sources.updateSource(ctx.db, id, patch),
  'calendar:deleteSource': ({ id, deleteEvents }, ctx) =>
    sources.deleteSource(ctx.db, id, deleteEvents),

  'calendar:pickIcsFiles': (_request, ctx) => pickIcsFiles(ctx.window),
  'calendar:previewIcsImport': (request, ctx) =>
    buildImportPreview(ctx.db, request, importZone(getSettings(ctx.db).timezone)),
  'calendar:commitIcsImport': (request, ctx) => {
    const result = commitImport(ctx.db, request)
    logger.info('[calendar] imported .ics', {
      count: result.imported,
      skipped: result.skipped,
      replaced: result.replaced
    })
    return result
  },
  'calendar:exportIcs': async ({ scope }, ctx) => {
    const built = buildExport(ctx.db, scope, ctx.now())
    const saved = await saveIcsFile(ctx.window, built.suggestedName, built.text)
    if (saved.canceled) return { canceled: true }
    logger.info('[calendar] exported .ics', { count: built.count })
    return { canceled: false, path: saved.path, count: built.count }
  }
} satisfies Partial<Handlers>
