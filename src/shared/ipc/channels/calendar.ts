import {
  commitIcsImportRequestSchema,
  createCalendarEventInputSchema,
  createCalendarSourceInputSchema,
  deleteSourceRequestSchema,
  exportIcsRequestSchema,
  listEventsRequestSchema,
  previewIcsImportRequestSchema,
  updateCalendarEventInputSchema,
  updateCalendarSourceInputSchema
} from '../../schemas/calendar'
import { emptyRequestSchema, idRequestSchema, patchRequest } from '../../schemas/common'
import type {
  CalendarEvent,
  CalendarSource,
  DeleteCalendarSourceResult,
  IcsExportResult,
  IcsImportPreview,
  IcsImportResult,
  IcsPickResult
} from '../../types/calendar'
import type { OkResponse } from '../../types/common'
import { defineChannel } from '../defineChannel'

const updateEventRequestSchema = patchRequest(updateCalendarEventInputSchema)
const updateSourceRequestSchema = patchRequest(updateCalendarSourceInputSchema)

export const calendarChannels = {
  'calendar:listEvents': defineChannel<typeof listEventsRequestSchema, CalendarEvent[]>(
    'calendar:listEvents',
    listEventsRequestSchema
  ),
  'calendar:getEvent': defineChannel<typeof idRequestSchema, CalendarEvent>(
    'calendar:getEvent',
    idRequestSchema
  ),
  'calendar:createEvent': defineChannel<typeof createCalendarEventInputSchema, CalendarEvent>(
    'calendar:createEvent',
    createCalendarEventInputSchema
  ),
  'calendar:updateEvent': defineChannel<typeof updateEventRequestSchema, CalendarEvent>(
    'calendar:updateEvent',
    updateEventRequestSchema
  ),
  'calendar:deleteEvent': defineChannel<typeof idRequestSchema, OkResponse>(
    'calendar:deleteEvent',
    idRequestSchema
  ),

  'calendar:listSources': defineChannel<typeof emptyRequestSchema, CalendarSource[]>(
    'calendar:listSources',
    emptyRequestSchema
  ),
  'calendar:createSource': defineChannel<typeof createCalendarSourceInputSchema, CalendarSource>(
    'calendar:createSource',
    createCalendarSourceInputSchema
  ),
  'calendar:updateSource': defineChannel<typeof updateSourceRequestSchema, CalendarSource>(
    'calendar:updateSource',
    updateSourceRequestSchema
  ),
  'calendar:deleteSource': defineChannel<
    typeof deleteSourceRequestSchema,
    DeleteCalendarSourceResult
  >('calendar:deleteSource', deleteSourceRequestSchema),

  'calendar:pickIcsFiles': defineChannel<typeof emptyRequestSchema, IcsPickResult>(
    'calendar:pickIcsFiles',
    emptyRequestSchema
  ),
  'calendar:previewIcsImport': defineChannel<
    typeof previewIcsImportRequestSchema,
    IcsImportPreview
  >('calendar:previewIcsImport', previewIcsImportRequestSchema),
  'calendar:commitIcsImport': defineChannel<typeof commitIcsImportRequestSchema, IcsImportResult>(
    'calendar:commitIcsImport',
    commitIcsImportRequestSchema
  ),
  'calendar:exportIcs': defineChannel<typeof exportIcsRequestSchema, IcsExportResult>(
    'calendar:exportIcs',
    exportIcsRequestSchema
  )
}
