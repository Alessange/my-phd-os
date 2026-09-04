import type { DialogResult, IsoDate, IsoInstant } from './common'

export const CALENDAR_EVENT_CATEGORIES = [
  'course',
  'research',
  'meeting',
  'deadline',
  'work',
  'health',
  'personal',
  'rest',
  'other'
] as const
export type CalendarEventCategory = (typeof CALENDAR_EVENT_CATEGORIES)[number]

export type CalendarEventStatus = 'confirmed' | 'cancelled'

export interface CalendarEvent {
  id: string
  title: string
  description?: string

  /** Canonical instants (ISO UTC). For all-day events these are `YYYY-MM-DD` dates (end exclusive). */
  startAt: string
  endAt: string
  timezone: string
  allDay: boolean

  category: CalendarEventCategory

  recurrenceRule?: string
  recurrenceId?: string
  location?: string

  sourceCalendarId?: string
  importedUid?: string

  linkedPersonalDeadlineId?: string
  linkedConferenceDeadlineId?: string
  linkedMilestoneId?: string

  sourceManaged: boolean
  createdAt: IsoInstant
  updatedAt: IsoInstant

  // Additions (ARCHITECTURE §4)
  exdates?: string[]
  rdates?: string[]
  recurrenceMasterId?: string
  status?: CalendarEventStatus
  sourceLabel?: string
  url?: string
}

export const CALENDAR_SOURCE_TYPES = ['imported', 'local', 'conference'] as const
export type CalendarSourceType = (typeof CALENDAR_SOURCE_TYPES)[number]

export interface CalendarSource {
  id: string
  name: string
  color: string
  type: CalendarSourceType
  originalFileName?: string
  importedAt: IsoInstant
  visible: boolean
}

export const CALENDAR_VIEWS = ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek'] as const
export type CalendarViewId = (typeof CALENDAR_VIEWS)[number]

// ---------------------------------------------------------------------------
// .ics import / export

export interface IcsFileInput {
  name: string
  text: string
}

export interface IcsImportFileSummary {
  name: string
  sizeBytes: number
  eventCount: number
  warnings: string[]
}

export interface IcsImportInvalidFile {
  name: string
  reason: string
}

export interface IcsImportPreviewEvent {
  /** Stable key within the preview (uid + recurrenceId or derived). */
  key: string
  fileName: string
  title: string
  startAt: string
  endAt: string
  allDay: boolean
  timezone: string
  location?: string
  recurring: boolean
  cancelled: boolean
}

export const ICS_DUPLICATE_REASONS = ['uid', 'recurrenceId', 'startInstant', 'source'] as const
export type IcsDuplicateReason = (typeof ICS_DUPLICATE_REASONS)[number]

export interface IcsImportConflict {
  key: string
  incoming: IcsImportPreviewEvent
  existingEventId: string
  existingTitle: string
  reason: IcsDuplicateReason
}

export interface IcsImportPreview {
  previewToken: string
  files: IcsImportFileSummary[]
  recognizedEvents: number
  dateRange?: { start: string; end: string }
  sampleEvents: IcsImportPreviewEvent[]
  conflicts: IcsImportConflict[]
  warnings: string[]
  invalidFiles: IcsImportInvalidFile[]
  targetSourceId?: string
}

export const ICS_CONFLICT_POLICIES = ['skip', 'replace', 'keepBoth'] as const
export type IcsConflictPolicy = (typeof ICS_CONFLICT_POLICIES)[number]

export type IcsImportSourceChoice =
  { mode: 'new'; name: string; color: string } | { mode: 'existing'; id: string }

export interface IcsImportResult {
  imported: number
  skipped: number
  replaced: number
  sourceId: string
  eventIds: string[]
}

export type IcsExportScope =
  | { type: 'all' }
  | { type: 'source'; sourceId: string }
  | { type: 'range'; start: IsoDate | IsoInstant; end: IsoDate | IsoInstant }
  | { type: 'events'; ids: string[] }

export type IcsExportResult = DialogResult<{ path: string; count: number }>
export type IcsPickResult = DialogResult<{ files: IcsFileInput[] }>

export interface DeleteCalendarSourceResult {
  ok: true
  deletedEvents: number
}
