import { z } from 'zod'
import { compareInstants } from '../dates/instant'
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

export const DEADLINE_WINDOW_MESSAGE = 'Tracking start must not be after the deadline'

/**
 * Cross-field rule shared by the create schema and `updatePersonalDeadline` (merged row):
 * compared as instants, so mixed offsets cannot slip an inverted window through.
 */
export const isValidDeadlineWindow = (v: {
  trackingStartAt: string
  deadlineAt: string
}): boolean => compareInstants(v.trackingStartAt, v.deadlineAt) <= 0

export const createPersonalDeadlineInputSchema = personalDeadlineSchema
  .omit({ id: true, createdAt: true, updatedAt: true, linkedCalendarEventId: true })
  .extend({
    status: personalDeadlineStatusSchema.default('not_started'),
    progress: percentSchema.default(0),
    priority: prioritySchema.default('medium')
  })
  .refine(isValidDeadlineWindow, { message: DEADLINE_WINDOW_MESSAGE, path: ['trackingStartAt'] })

export const updatePersonalDeadlineInputSchema = personalDeadlineSchema
  .omit({ id: true, createdAt: true, updatedAt: true, linkedCalendarEventId: true })
  .partial()

export type CreatePersonalDeadlineInput = z.input<typeof createPersonalDeadlineInputSchema>
export type UpdatePersonalDeadlineInput = z.infer<typeof updatePersonalDeadlineInputSchema>

/** The whole filter is optional (ARCHITECTURE §6): `api('personalDeadlines:list')` lists active ones. */
export const listPersonalDeadlinesRequestSchema = z
  .object({
    includeCompleted: z.boolean().optional()
  })
  .optional()
export const setProgressRequestSchema = z.object({ id: idSchema, progress: percentSchema })
export const linkCalendarEventRequestSchema = z.object({
  id: idSchema,
  mode: z.enum(['allDay', 'exact'])
})
export const unlinkCalendarEventRequestSchema = z.object({ id: idSchema, deleteEvent: z.boolean() })
