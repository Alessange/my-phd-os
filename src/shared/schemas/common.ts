import { z } from 'zod'
import { isValidZoneInput } from '../dates/zones'
import { isAllDayDate } from '../dates/allDay'
import { APP_ERROR_CODES } from '../types/common'

/** ISO-8601 instant with `Z` or an explicit offset. Main normalises stored values to UTC. */
export const isoInstantSchema = z.iso.datetime({ offset: true })
/** `YYYY-MM-DD`, validated as a real calendar date. */
export const isoDateSchema = z.string().refine(isAllDayDate, 'Expected a YYYY-MM-DD date')
/** Either an instant or an all-day date (used where `allDay` decides the meaning). */
export const instantOrDateSchema = z.union([isoInstantSchema, isoDateSchema])

export const idSchema = z.string().min(1).max(200)
export const idListSchema = z.array(idSchema).max(10_000)
export const titleSchema = z.string().trim().min(1, 'Title is required').max(500)
export const longTextSchema = z.string().max(20_000)
export const shortTextSchema = z.string().max(1_000)
export const timezoneSchema = z.string().trim().min(1).refine(isValidZoneInput, 'Unknown timezone')
export const colorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, 'Expected a hex color like #3b82f6')
export const percentSchema = z.number().min(0).max(100)
export const httpUrlSchema = z
  .url()
  .refine((u) => /^https?:$/.test(new URL(u).protocol), 'Only http(s) URLs are allowed')
export const tagsSchema = z.array(z.string().trim().min(1).max(100)).max(100)

export const appErrorCodeSchema = z.enum(APP_ERROR_CODES)
export const ipcErrorSchema = z.object({
  code: appErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional()
})

/** Request schema for channels that take no payload. */
export const emptyRequestSchema = z.undefined()
export const okResponseSchema = z.object({ ok: z.literal(true) })
export const idRequestSchema = z.object({ id: idSchema })

/** `id` + partial patch envelope used by every `update` channel. */
export const patchRequest = <T extends z.ZodType>(
  patch: T
): z.ZodObject<{ id: typeof idSchema; patch: T }> => z.object({ id: idSchema, patch })

export type IdRequest = z.infer<typeof idRequestSchema>
