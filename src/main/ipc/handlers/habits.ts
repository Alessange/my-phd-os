import * as completions from '../../database/repositories/habitCompletions'
import * as habits from '../../database/repositories/habits'
import type { Handlers } from '../registry'
import { OK } from './shared'

export const habitHandlers = {
  'habits:list': (filter, ctx) => habits.listHabits(ctx.db, filter ?? {}),
  'habits:get': ({ id }, ctx) => habits.getHabit(ctx.db, id),
  'habits:create': (input, ctx) => habits.createHabit(ctx.db, input),
  'habits:update': ({ id, patch }, ctx) => habits.updateHabit(ctx.db, id, patch),
  'habits:setArchived': ({ id, archived }, ctx) => habits.setHabitArchived(ctx.db, id, archived),
  'habits:delete': ({ id }, ctx) => {
    habits.deleteHabit(ctx.db, id)
    return OK
  },
  'habits:listCompletions': (request, ctx) => completions.listCompletions(ctx.db, request),
  'habits:setCompletion': ({ habitId, date, completed }, ctx) =>
    completions.setCompletion(ctx.db, habitId, date, completed)
} satisfies Partial<Handlers>
