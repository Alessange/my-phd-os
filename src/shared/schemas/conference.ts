import { z } from 'zod'
import {
  CCF_RANKS,
  CCF_SUBJECT_CODES,
  CONFERENCE_STATUSES,
  CORE_RANKS,
  FOLLOW_INTENTIONS,
  REFRESH_OUTCOME_STATUSES,
  THCPL_RANKS
} from '../types/conference'
import {
  httpUrlSchema,
  idListSchema,
  idSchema,
  isoInstantSchema,
  longTextSchema,
  percentSchema,
  shortTextSchema,
  titleSchema
} from './common'

export const ccfRankSchema = z.enum(CCF_RANKS)
export const coreRankSchema = z.enum(CORE_RANKS)
export const thcplRankSchema = z.enum(THCPL_RANKS)
export const ccfSubjectCodeSchema = z.enum(CCF_SUBJECT_CODES)
export const subscriptionLanguageSchema = z.enum(['en', 'zh'])
export const subscriptionKindSchema = z.enum(['official', 'custom'])
export const conferenceStatusSchema = z.enum(CONFERENCE_STATUSES)
export const followIntentionSchema = z.enum(FOLLOW_INTENTIONS)
export const refreshOutcomeStatusSchema = z.enum(REFRESH_OUTCOME_STATUSES)

export const subscriptionFiltersSchema = z.object({
  ccf: ccfRankSchema.optional(),
  core: coreRankSchema.optional(),
  thcpl: thcplRankSchema.optional(),
  subject: ccfSubjectCodeSchema.optional()
})

export const subscriptionErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  at: isoInstantSchema
})

export const conferenceSubscriptionSchema = z.object({
  id: idSchema,
  url: httpUrlSchema,
  label: titleSchema,
  kind: subscriptionKindSchema,
  language: subscriptionLanguageSchema.optional(),
  filters: subscriptionFiltersSchema.optional(),
  enabled: z.boolean(),
  etag: z.string().optional(),
  lastModified: z.string().optional(),
  contentHash: z.string().optional(),
  lastSuccessAt: isoInstantSchema.optional(),
  lastAttemptAt: isoInstantSchema.optional(),
  lastError: subscriptionErrorSchema.optional(),
  customConfirmedAt: isoInstantSchema.optional(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema
})

export const conferenceDeadlineSchema = z.object({
  id: idSchema,
  subscriptionId: idSchema,

  upstreamUid: z.string().optional(),
  title: z.string().min(1),
  conferenceName: z.string().optional(),
  conferenceYear: z.number().int().optional(),
  fullName: z.string().optional(),

  category: z.string().optional(),
  ccfRank: z.string().optional(),
  coreRank: z.string().optional(),
  thcplRank: z.string().optional(),

  deadlineRound: z.string().optional(),
  comment: z.string().optional(),

  location: z.string().optional(),
  conferenceStartAt: isoInstantSchema.optional(),
  conferenceEndAt: isoInstantSchema.optional(),

  deadlineAt: isoInstantSchema.optional(),
  originalTimezone: z.string().optional(),
  rawDtStart: z.string().optional(),

  homepageUrl: z.string().optional(),
  sourceUrl: z.string(),

  status: conferenceStatusSchema,
  rawIcsData: z.string().optional(),

  upstreamSnapshotHash: z.string(),
  upstreamUpdatedAt: isoInstantSchema.optional(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,

  stableKey: z.string().min(1),
  deadlineKind: z.enum(['abstract', 'deadline']),
  conferenceDatesText: z.string().optional(),
  dblpUrl: z.string().optional(),
  firstSeenAt: isoInstantSchema,
  lastSeenAt: isoInstantSchema,
  originalTimezoneLabel: z.string().optional(),
  allDay: z.boolean()
})

export const followedConferenceSchema = z.object({
  conferenceDeadlineId: idSchema,
  followedAt: isoInstantSchema,
  intention: followIntentionSchema.optional(),
  progress: percentSchema.optional(),
  notes: longTextSchema.optional(),
  calendarEventId: idSchema.optional()
})

export const conferenceDeadlineChangeSchema = z.object({
  id: idSchema,
  conferenceDeadlineId: idSchema,
  field: z.string().min(1),
  previousValue: z.unknown(),
  currentValue: z.unknown(),
  detectedAt: isoInstantSchema,
  upstreamSnapshotHash: z.string(),
  acknowledged: z.boolean()
})

// ---------------------------------------------------------------------------
// Channel requests

export const addSubscriptionRequestSchema = z.object({
  url: httpUrlSchema,
  label: shortTextSchema.optional(),
  kind: subscriptionKindSchema,
  language: subscriptionLanguageSchema.optional(),
  filters: subscriptionFiltersSchema.optional(),
  /** Required (true) before a non-official host is accepted. */
  confirmCustom: z.boolean().optional()
})
export type AddSubscriptionRequest = z.infer<typeof addSubscriptionRequestSchema>

export const updateSubscriptionPatchSchema = z.object({
  enabled: z.boolean().optional(),
  label: titleSchema.optional()
})
export type UpdateSubscriptionPatch = z.infer<typeof updateSubscriptionPatchSchema>

export const refreshRequestSchema = z
  .object({ subscriptionId: idSchema.optional(), force: z.boolean().optional() })
  .optional()
export type RefreshRequest = z.infer<typeof refreshRequestSchema>

export const listConferenceDeadlinesRequestSchema = z
  .object({
    search: z.string().max(500).optional(),
    categories: z.array(z.string()).optional(),
    ccfRanks: z.array(z.string()).optional(),
    coreRanks: z.array(z.string()).optional(),
    thcplRanks: z.array(z.string()).optional(),
    years: z.array(z.number().int()).optional(),
    statuses: z.array(conferenceStatusSchema).optional(),
    followedOnly: z.boolean().optional(),
    hidePassed: z.boolean().optional()
  })
  .optional()
export type ListConferenceDeadlinesRequest = z.infer<typeof listConferenceDeadlinesRequestSchema>

export const followRequestSchema = z.object({
  id: idSchema,
  intention: followIntentionSchema.optional()
})

export const updateFollowPatchSchema = z.object({
  intention: followIntentionSchema.optional(),
  progress: percentSchema.optional(),
  notes: longTextSchema.optional()
})
export type UpdateFollowPatch = z.infer<typeof updateFollowPatchSchema>

export const listChangesRequestSchema = z
  .object({ unacknowledgedOnly: z.boolean().optional(), followedOnly: z.boolean().optional() })
  .optional()
export type ListChangesRequest = z.infer<typeof listChangesRequestSchema>

export const acknowledgeChangesRequestSchema = z.object({ ids: idListSchema.min(1) })
