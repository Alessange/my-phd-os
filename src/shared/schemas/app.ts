import { z } from 'zod'
import { LOG_LEVELS } from '../types/app'
import { CLEAR_ALL_DATA_CONFIRMATION, BACKUP_IMPORT_MODES } from '../types/data'
import { httpUrlSchema } from './common'

export const openExternalRequestSchema = z.object({ url: httpUrlSchema })

export const logRequestSchema = z.object({
  level: z.enum(LOG_LEVELS),
  message: z.string().max(10_000),
  context: z.record(z.string(), z.unknown()).optional()
})
export type LogRequest = z.infer<typeof logRequestSchema>

export const commitBackupImportRequestSchema = z.object({
  previewToken: z.string().min(1),
  mode: z.enum(BACKUP_IMPORT_MODES)
})

export const clearAllDataRequestSchema = z.object({
  confirmation: z.literal(CLEAR_ALL_DATA_CONFIRMATION)
})
