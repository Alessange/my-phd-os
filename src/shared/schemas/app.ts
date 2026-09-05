import { z } from 'zod'
import { LOG_LEVELS } from '../types/app'
import { CLEAR_ALL_DATA_CONFIRMATION, BACKUP_IMPORT_MODES } from '../types/data'
import { httpUrlSchema } from './common'

export const openExternalRequestSchema = z.object({ url: httpUrlSchema })

/** One renderer log line. `context` is primitive-only and bounded; main sanitises it again. */
export const logRequestSchema = z.object({
  level: z.enum(LOG_LEVELS),
  message: z.string().max(2_000),
  context: z
    .record(z.string().max(64), z.union([z.string().max(2_000), z.number(), z.boolean(), z.null()]))
    .refine((record) => Object.keys(record).length <= 20, 'At most 20 context keys')
    .optional()
})
export type LogRequest = z.infer<typeof logRequestSchema>

export const commitBackupImportRequestSchema = z.object({
  previewToken: z.string().min(1),
  mode: z.enum(BACKUP_IMPORT_MODES)
})

export const clearAllDataRequestSchema = z.object({
  confirmation: z.literal(CLEAR_ALL_DATA_CONFIRMATION)
})
