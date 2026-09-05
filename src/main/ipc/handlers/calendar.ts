import * as events from '../../database/repositories/calendarEvents'
import * as sources from '../../database/repositories/calendarSources'
import type { Handlers } from '../registry'
import { OK, notImplemented } from './shared'

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

  // Owned by the calendar feature agent (src/main/filesystem/icsFiles.ts + src/shared/ics).
  'calendar:pickIcsFiles': () => notImplemented('Choosing .ics files'),
  'calendar:previewIcsImport': () => notImplemented('.ics import preview'),
  'calendar:commitIcsImport': () => notImplemented('.ics import'),
  'calendar:exportIcs': () => notImplemented('.ics export')
} satisfies Partial<Handlers>
