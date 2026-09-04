import { z } from 'zod'
import {
  DEADLINE_STATUSES,
  PERSONAL_DEADLINE_CATEGORIES,
  PERSONAL_DEADLINE_STATUSES,
  PRIORITIES
} from '../types/personalDeadline'
import {
  httpUrlSchema,
  idSchema,
  isoInstantSchema,
  longTextSchema,
  percentSchema,
  shortTextSchema,
  tagsSchema,
  timezoneSchema,
  titleSchema
} from './common'

export const personalDeadlineCategorySchema = z.enum(PERSONAL_DEADLINE_CATEGORIES)
export const prioritySchema = z.enum(PRIORITIES)
export const personalDeadlineStatusSchema = z.enum(PERSONAL_DEADLINE_STATUSES)
export const deadlineStatusSchema = z.enum(DEADLINE_STATUSES)

export const personalDeadlineSchema = z.object({
  id: idSchema,
  title: titleSchema,
  description: longTextSchema.optional(),

  trackingStartAt: isoInstantSchema,
  deadlineAt: isoInstantSchema,
  timezone: timezoneSchema,

  category: personalDeadlineCategorySchema,
  priority: prioritySchema,
  status: personalDeadlineStatusSchema,
  progress: percentSchema,

  sourceUrl: httpUrlSchema.optional(),
  location: shortTextSchema.optional(),
  tags: tagsSchema.optional(),

  linkedMilestoneId: idSchema.optional(),
  linkedCalendarEventId: idSchema.optional(),

  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema
})

export const createPersonalDeadlineInputSchema = personalDeadlineSchema
  .omit({ id: true, createdAt: true, updatedAt: true, linkedCalendarEventId: true })
  .extend({
    status: personalDeadlineStatusSchema.default('not_started'),
    progress: percentSchema.default(0),
    priority: prioritySchema.default('medium')
  })
  .refine((v) => v.trackingStartAt <= v.deadlineAt, {
    message: 'Tracking start must not be after the deadline',
    path: ['trackingStartAt']
  })

export const updatePersonalDeadlineInputSchema = personalDeadlineSchema
  .omit({ id: true, createdAt: true, updatedAt: true, linkedCalendarEventId: true })
  .partial()

export type CreatePersonalDeadlineInput = z.input<typeof createPersonalDeadlineInputSchema>
export type UpdatePersonalDeadlineInput = z.infer<typeof updatePersonalDeadlineInputSchema>

export const listPersonalDeadlinesRequestSchema = z.object({
  includeCompleted: z.boolean().optional()
})
export const setProgressRequestSchema = z.object({ id: idSchema, progress: percentSchema })
export const linkCalendarEventRequestSchema = z.object({
  id: idSchema,
  mode: z.enum(['allDay', 'exact'])
})
export const unlinkCalendarEventRequestSchema = z.object({ id: idSchema, deleteEvent: z.boolean() })
