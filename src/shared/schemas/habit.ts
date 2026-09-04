import { z } from 'zod'
import { colorSchema, idSchema, isoDateSchema, isoInstantSchema, titleSchema } from './common'

export const habitFrequencySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily') }),
  z.object({ type: z.literal('weekly'), targetCount: z.number().int().min(1).max(7) }),
  z.object({
    type: z.literal('specific_days'),
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7)
  })
])

export const habitSchema = z.object({
  id: idSchema,
  name: titleSchema,
  color: colorSchema,
  icon: z.string().max(100).optional(),
  frequency: habitFrequencySchema,
  createdAt: isoInstantSchema,
  archivedAt: isoInstantSchema.optional()
})

export const createHabitInputSchema = habitSchema.omit({
  id: true,
  createdAt: true,
  archivedAt: true
})
export const updateHabitInputSchema = createHabitInputSchema.partial()

export type CreateHabitInput = z.infer<typeof createHabitInputSchema>
export type UpdateHabitInput = z.infer<typeof updateHabitInputSchema>

export const habitCompletionSchema = z.object({
  id: idSchema,
  habitId: idSchema,
  date: isoDateSchema,
  completed: z.boolean()
})

export const listHabitsRequestSchema = z
  .object({ includeArchived: z.boolean().optional() })
  .optional()
export const setArchivedRequestSchema = z.object({ id: idSchema, archived: z.boolean() })
export const listCompletionsRequestSchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  habitId: idSchema.optional()
})
export const setCompletionRequestSchema = z.object({
  habitId: idSchema,
  date: isoDateSchema,
  completed: z.boolean()
})
