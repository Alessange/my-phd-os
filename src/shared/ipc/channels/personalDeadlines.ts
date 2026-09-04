import { idRequestSchema, patchRequest } from '../../schemas/common'
import {
  createPersonalDeadlineInputSchema,
  linkCalendarEventRequestSchema,
  listPersonalDeadlinesRequestSchema,
  setProgressRequestSchema,
  unlinkCalendarEventRequestSchema,
  updatePersonalDeadlineInputSchema
} from '../../schemas/personalDeadline'
import type { OkResponse } from '../../types/common'
import type { LinkCalendarEventResult, PersonalDeadline } from '../../types/personalDeadline'
import { defineChannel } from '../defineChannel'

const updateRequestSchema = patchRequest(updatePersonalDeadlineInputSchema)

export const personalDeadlineChannels = {
  'personalDeadlines:list': defineChannel<
    typeof listPersonalDeadlinesRequestSchema,
    PersonalDeadline[]
  >('personalDeadlines:list', listPersonalDeadlinesRequestSchema),
  'personalDeadlines:get': defineChannel<typeof idRequestSchema, PersonalDeadline>(
    'personalDeadlines:get',
    idRequestSchema
  ),
  'personalDeadlines:create': defineChannel<
    typeof createPersonalDeadlineInputSchema,
    PersonalDeadline
  >('personalDeadlines:create', createPersonalDeadlineInputSchema),
  'personalDeadlines:update': defineChannel<typeof updateRequestSchema, PersonalDeadline>(
    'personalDeadlines:update',
    updateRequestSchema
  ),
  'personalDeadlines:delete': defineChannel<typeof idRequestSchema, OkResponse>(
    'personalDeadlines:delete',
    idRequestSchema
  ),
  'personalDeadlines:setProgress': defineChannel<typeof setProgressRequestSchema, PersonalDeadline>(
    'personalDeadlines:setProgress',
    setProgressRequestSchema
  ),
  'personalDeadlines:linkCalendarEvent': defineChannel<
    typeof linkCalendarEventRequestSchema,
    LinkCalendarEventResult
  >('personalDeadlines:linkCalendarEvent', linkCalendarEventRequestSchema),
  'personalDeadlines:unlinkCalendarEvent': defineChannel<
    typeof unlinkCalendarEventRequestSchema,
    PersonalDeadline
  >('personalDeadlines:unlinkCalendarEvent', unlinkCalendarEventRequestSchema)
}
