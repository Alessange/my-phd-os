import { z } from 'zod'
import { MILESTONE_CATEGORIES, MILESTONE_STATUSES } from '../types/milestone'
import {
  colorSchema,
  idSchema,
  isoInstantSchema,
  longTextSchema,
  percentSchema,
  titleSchema
} from './common'

export const milestoneCategorySchema = z.enum(MILESTONE_CATEGORIES)
export const milestoneStatusSchema = z.enum(MILESTONE_STATUSES)

export const milestoneSchema = z.object({
  id: idSchema,
  title: titleSchema,
  description: longTextSchema.optional(),
  startAt: isoInstantSchema,
  targetAt: isoInstantSchema,
  category: milestoneCategorySchema,
  status: milestoneStatusSchema,
  progress: percentSchema,
  color: colorSchema.optional(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema
})

export const createMilestoneInputSchema = milestoneSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: milestoneStatusSchema.default('not_started'),
    progress: percentSchema.default(0)
  })

/** Optional fields accept `null` on update so they can be cleared; `undefined` leaves them untouched. */
export const updateMilestoneInputSchema = milestoneSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial()
  .extend({
    description: longTextSchema.nullable().optional(),
    color: colorSchema.nullable().optional()
  })

export type CreateMilestoneInput = z.input<typeof createMilestoneInputSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInputSchema>
