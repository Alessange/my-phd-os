import * as deadlines from '../../database/repositories/personalDeadlines'
import type { Handlers } from '../registry'
import { OK, notImplemented } from './shared'

export const personalDeadlineHandlers = {
  'personalDeadlines:list': (filter, ctx) => deadlines.listPersonalDeadlines(ctx.db, filter),
  'personalDeadlines:get': ({ id }, ctx) => deadlines.getPersonalDeadline(ctx.db, id),
  'personalDeadlines:create': (input, ctx) => deadlines.createPersonalDeadline(ctx.db, input),
  'personalDeadlines:update': ({ id, patch }, ctx) =>
    deadlines.updatePersonalDeadline(ctx.db, id, patch),
  'personalDeadlines:delete': ({ id }, ctx) => {
    deadlines.deletePersonalDeadline(ctx.db, id)
    return OK
  },
  'personalDeadlines:setProgress': ({ id, progress }, ctx) =>
    deadlines.setPersonalDeadlineProgress(ctx.db, id, progress),

  // Owned by the personal-deadlines feature agent.
  'personalDeadlines:linkCalendarEvent': () => notImplemented('Linking a deadline to the calendar'),
  'personalDeadlines:unlinkCalendarEvent': () =>
    notImplemented('Unlinking a deadline from the calendar')
} satisfies Partial<Handlers>
