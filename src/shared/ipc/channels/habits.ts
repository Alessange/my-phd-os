import { idRequestSchema, patchRequest } from '../../schemas/common'
import {
  createHabitInputSchema,
  listCompletionsRequestSchema,
  listHabitsRequestSchema,
  setArchivedRequestSchema,
  setCompletionRequestSchema,
  updateHabitInputSchema
} from '../../schemas/habit'
import type { OkResponse } from '../../types/common'
import type { Habit, HabitCompletion } from '../../types/habit'
import { defineChannel } from '../defineChannel'

const updateRequestSchema = patchRequest(updateHabitInputSchema)

export const habitChannels = {
  'habits:list': defineChannel<typeof listHabitsRequestSchema, Habit[]>(
    'habits:list',
    listHabitsRequestSchema
  ),
  'habits:get': defineChannel<typeof idRequestSchema, Habit>('habits:get', idRequestSchema),
  'habits:create': defineChannel<typeof createHabitInputSchema, Habit>(
    'habits:create',
    createHabitInputSchema
  ),
  'habits:update': defineChannel<typeof updateRequestSchema, Habit>(
    'habits:update',
    updateRequestSchema
  ),
  'habits:setArchived': defineChannel<typeof setArchivedRequestSchema, Habit>(
    'habits:setArchived',
    setArchivedRequestSchema
  ),
  'habits:delete': defineChannel<typeof idRequestSchema, OkResponse>(
    'habits:delete',
    idRequestSchema
  ),
  'habits:listCompletions': defineChannel<typeof listCompletionsRequestSchema, HabitCompletion[]>(
    'habits:listCompletions',
    listCompletionsRequestSchema
  ),
  'habits:setCompletion': defineChannel<typeof setCompletionRequestSchema, HabitCompletion>(
    'habits:setCompletion',
    setCompletionRequestSchema
  )
}
