import { z } from 'zod'
import { CALENDAR_VIEWS } from '../types/calendar'
import {
  DATE_FORMATS,
  DEADLINES_TABS,
  PAGE_IDS,
  PERSONAL_DEADLINES_VIEWS,
  THEMES,
  TIMELINE_VIEWS
} from '../types/settings'
import { isoInstantSchema, timezoneSchema } from './common'

export const pageIdSchema = z.enum(PAGE_IDS)

export const appSettingsSchema = z.object({
  timezone: z.union([z.literal('system'), timezoneSchema]),
  dateFormat: z.enum(DATE_FORMATS),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  clock: z.enum(['12h', '24h']),
  theme: z.enum(THEMES),
  defaultCalendarView: z.enum(CALENDAR_VIEWS),
  launchPage: z.enum(['last', 'calendar']),
  subscriptionRefreshIntervalHours: z
    .number()
    .min(1)
    .max(24 * 7),
  refreshOnLaunch: z.boolean(),
  requestTimeoutMs: z.number().int().min(1_000).max(120_000)
})
export const updateSettingsInputSchema = appSettingsSchema.partial()
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>

export const uiStateSchema = z.object({
  lastPage: pageIdSchema,
  calendarView: z.enum(CALENDAR_VIEWS),
  sidebarCollapsed: z.boolean(),
  deadlinesTab: z.enum(DEADLINES_TABS),
  personalDeadlinesView: z.enum(PERSONAL_DEADLINES_VIEWS),
  timelineView: z.enum(TIMELINE_VIEWS)
})
export const updateUiStateInputSchema = uiStateSchema.partial()
export type UpdateUiStateInput = z.infer<typeof updateUiStateInputSchema>

export const dismissedWarningSchema = z.object({
  key: z.string().min(1).max(500),
  dismissedAt: isoInstantSchema,
  payload: z.unknown().optional()
})
export const dismissWarningRequestSchema = dismissedWarningSchema.omit({ dismissedAt: true })
export const restoreWarningRequestSchema = z.object({ key: z.string().min(1).max(500) })
