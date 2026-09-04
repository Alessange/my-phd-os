import { z } from 'zod'
import {
  CALENDAR_EVENT_CATEGORIES,
  CALENDAR_SOURCE_TYPES,
  CALENDAR_VIEWS,
  ICS_CONFLICT_POLICIES,
  ICS_DUPLICATE_REASONS
} from '../types/calendar'
import {
  colorSchema,
  httpUrlSchema,
  idListSchema,
  idSchema,
  instantOrDateSchema,
  isoInstantSchema,
  longTextSchema,
  shortTextSchema,
  timezoneSchema,
  titleSchema
} from './common'

export const calendarEventCategorySchema = z.enum(CALENDAR_EVENT_CATEGORIES)
export const calendarSourceTypeSchema = z.enum(CALENDAR_SOURCE_TYPES)
export const calendarViewSchema = z.enum(CALENDAR_VIEWS)
export const calendarEventStatusSchema = z.enum(['confirmed', 'cancelled'])

export const calendarEventSchema = z.object({
  id: idSchema,
  title: titleSchema,
  description: longTextSchema.optional(),

  startAt: instantOrDateSchema,
  endAt: instantOrDateSchema,
  timezone: timezoneSchema,
  allDay: z.boolean(),

  category: calendarEventCategorySchema,

  recurrenceRule: z.string().max(2_000).optional(),
  recurrenceId: z.string().max(200).optional(),
  location: shortTextSchema.optional(),

  sourceCalendarId: idSchema.optional(),
  importedUid: z.string().max(1_000).optional(),

  linkedPersonalDeadlineId: idSchema.optional(),
  linkedConferenceDeadlineId: idSchema.optional(),
  linkedMilestoneId: idSchema.optional(),

  sourceManaged: z.boolean(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,

  exdates: z.array(instantOrDateSchema).max(10_000).optional(),
  rdates: z.array(instantOrDateSchema).max(10_000).optional(),
  recurrenceMasterId: idSchema.optional(),
  status: calendarEventStatusSchema.optional(),
  sourceLabel: shortTextSchema.optional(),
  url: httpUrlSchema.optional()
})

const eventTimeRule = (
  value: { allDay: boolean; startAt: string; endAt: string },
  ctx: z.RefinementCtx
): void => {
  const isDate = (s: string): boolean => s.length === 10
  if (value.allDay !== isDate(value.startAt) || value.allDay !== isDate(value.endAt)) {
    ctx.addIssue({
      code: 'custom',
      message: value.allDay
        ? 'All-day events use YYYY-MM-DD dates for startAt and endAt'
        : 'Timed events use ISO instants for startAt and endAt',
      path: ['startAt']
    })
  }
  if (value.endAt < value.startAt) {
    ctx.addIssue({ code: 'custom', message: 'endAt must not be before startAt', path: ['endAt'] })
  }
}

export const createCalendarEventInputSchema = calendarEventSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({ sourceManaged: z.boolean().default(false) })
  .superRefine(eventTimeRule)

export const updateCalendarEventInputSchema = calendarEventSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial()

export type CreateCalendarEventInput = z.input<typeof createCalendarEventInputSchema>
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventInputSchema>

export const calendarSourceSchema = z.object({
  id: idSchema,
  name: titleSchema,
  color: colorSchema,
  type: calendarSourceTypeSchema,
  originalFileName: z.string().max(500).optional(),
  importedAt: isoInstantSchema,
  visible: z.boolean()
})

export const createCalendarSourceInputSchema = calendarSourceSchema
  .omit({ id: true, importedAt: true })
  .extend({ visible: z.boolean().default(true) })
export const updateCalendarSourceInputSchema = calendarSourceSchema
  .omit({ id: true, importedAt: true })
  .partial()

export type CreateCalendarSourceInput = z.input<typeof createCalendarSourceInputSchema>
export type UpdateCalendarSourceInput = z.infer<typeof updateCalendarSourceInputSchema>

// ---------------------------------------------------------------------------
// Channel requests

export const listEventsRequestSchema = z.object({
  rangeStart: instantOrDateSchema.optional(),
  rangeEnd: instantOrDateSchema.optional(),
  sourceIds: idListSchema.optional(),
  categories: z.array(calendarEventCategorySchema).optional(),
  includeHiddenSources: z.boolean().optional()
})
export type ListEventsRequest = z.infer<typeof listEventsRequestSchema>

export const deleteSourceRequestSchema = z.object({ id: idSchema, deleteEvents: z.boolean() })

export const icsFileInputSchema = z.object({
  name: z.string().min(1).max(500),
  text: z.string().max(50 * 1024 * 1024)
})
export const icsFilesSchema = z.array(icsFileInputSchema).min(1).max(50)

export const previewIcsImportRequestSchema = z.object({
  files: icsFilesSchema,
  targetSourceId: idSchema.optional()
})
export type PreviewIcsImportRequest = z.infer<typeof previewIcsImportRequestSchema>

export const icsConflictPolicySchema = z.enum(ICS_CONFLICT_POLICIES)
export const icsDuplicateReasonSchema = z.enum(ICS_DUPLICATE_REASONS)

export const icsImportSourceChoiceSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('new'), name: titleSchema, color: colorSchema }),
  z.object({ mode: z.literal('existing'), id: idSchema })
])

export const commitIcsImportRequestSchema = z.object({
  previewToken: z.string().min(1),
  conflictPolicy: icsConflictPolicySchema,
  source: icsImportSourceChoiceSchema
})
export type CommitIcsImportRequest = z.infer<typeof commitIcsImportRequestSchema>

export const icsExportScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('source'), sourceId: idSchema }),
  z.object({ type: z.literal('range'), start: instantOrDateSchema, end: instantOrDateSchema }),
  z.object({ type: z.literal('events'), ids: idListSchema.min(1) })
])
export const exportIcsRequestSchema = z.object({ scope: icsExportScopeSchema })
export type ExportIcsRequest = z.infer<typeof exportIcsRequestSchema>
