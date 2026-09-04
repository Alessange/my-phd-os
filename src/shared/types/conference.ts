import type { IsoInstant } from './common'

export const CCF_RANKS = ['A', 'B', 'C'] as const
export type CcfRank = (typeof CCF_RANKS)[number]
export const CORE_RANKS = ['A*', 'A', 'B', 'C'] as const
export type CoreRank = (typeof CORE_RANKS)[number]
export const THCPL_RANKS = ['A', 'B'] as const
export type ThcplRank = (typeof THCPL_RANKS)[number]

export const CCF_SUBJECT_CODES = [
  'DS',
  'NW',
  'SC',
  'SE',
  'DB',
  'CT',
  'CG',
  'AI',
  'HI',
  'MX'
] as const
export type CcfSubjectCode = (typeof CCF_SUBJECT_CODES)[number]

export type SubscriptionLanguage = 'en' | 'zh'
export type SubscriptionKind = 'official' | 'custom'

export interface SubscriptionFilters {
  ccf?: CcfRank
  core?: CoreRank
  thcpl?: ThcplRank
  subject?: CcfSubjectCode
}

export interface SubscriptionError {
  message: string
  code?: string
  at: IsoInstant
}

export interface ConferenceSubscription {
  id: string
  url: string
  label: string
  kind: SubscriptionKind
  language?: SubscriptionLanguage
  filters?: SubscriptionFilters
  enabled: boolean
  etag?: string
  lastModified?: string
  contentHash?: string
  lastSuccessAt?: IsoInstant
  lastAttemptAt?: IsoInstant
  lastError?: SubscriptionError
  customConfirmedAt?: IsoInstant
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

export const CONFERENCE_STATUSES = ['upcoming', 'passed', 'tbd'] as const
export type ConferenceStatus = (typeof CONFERENCE_STATUSES)[number]

export type ConferenceDeadlineKind = 'abstract' | 'deadline'

export interface ConferenceDeadline {
  id: string
  subscriptionId: string

  upstreamUid?: string
  title: string
  conferenceName?: string
  conferenceYear?: number
  fullName?: string

  category?: string
  ccfRank?: string
  coreRank?: string
  thcplRank?: string

  deadlineRound?: string
  comment?: string

  location?: string
  conferenceStartAt?: IsoInstant
  conferenceEndAt?: IsoInstant

  /** Canonical instant; `undefined` when `status === 'tbd'`. */
  deadlineAt?: IsoInstant
  originalTimezone?: string
  rawDtStart?: string

  homepageUrl?: string
  sourceUrl: string

  status: ConferenceStatus
  rawIcsData?: string

  upstreamSnapshotHash: string
  upstreamUpdatedAt?: IsoInstant
  createdAt: IsoInstant
  updatedAt: IsoInstant

  // Additions (ARCHITECTURE §4)
  stableKey: string
  deadlineKind: ConferenceDeadlineKind
  conferenceDatesText?: string
  dblpUrl?: string
  firstSeenAt: IsoInstant
  lastSeenAt: IsoInstant
  originalTimezoneLabel?: string
  allDay: boolean
}

export const FOLLOW_INTENTIONS = ['watching', 'considering', 'submitting'] as const
export type FollowIntention = (typeof FOLLOW_INTENTIONS)[number]

export interface FollowedConference {
  conferenceDeadlineId: string
  followedAt: IsoInstant

  intention?: FollowIntention
  progress?: number
  notes?: string

  calendarEventId?: string
}

export interface ConferenceDeadlineChange {
  id: string
  conferenceDeadlineId: string
  field: string

  previousValue: unknown
  currentValue: unknown

  detectedAt: IsoInstant
  upstreamSnapshotHash: string
  acknowledged: boolean
}

export interface ConferenceDeadlineView extends ConferenceDeadline {
  followed?: FollowedConference
  subscriptionLabel: string
}

export interface ConferenceDeadlineChangeView extends ConferenceDeadlineChange {
  conferenceTitle: string
  followed: boolean
}

export const REFRESH_OUTCOME_STATUSES = ['updated', 'unchanged', 'failed', 'skipped'] as const
export type RefreshOutcomeStatus = (typeof REFRESH_OUTCOME_STATUSES)[number]

export interface RefreshOutcome {
  subscriptionId: string
  status: RefreshOutcomeStatus
  fetchedAt: IsoInstant
  error?: SubscriptionError
  changes: number
  added: number
  removed: number
}

export interface SubscriptionRefreshState {
  subscriptionId: string
  inProgress: boolean
  lastSuccessAt?: IsoInstant
  lastAttemptAt?: IsoInstant
  lastError?: SubscriptionError
  lastOutcome?: RefreshOutcomeStatus
}

export interface RefreshStatus {
  inProgress: boolean
  lastSuccessAt?: IsoInstant
  lastAttemptAt?: IsoInstant
  lastError?: SubscriptionError
  nextAutoRefreshAt?: IsoInstant
  perSubscription: Record<string, SubscriptionRefreshState>
}

export interface RemoveSubscriptionResult {
  ok: true
  removedDeadlines: number
}
