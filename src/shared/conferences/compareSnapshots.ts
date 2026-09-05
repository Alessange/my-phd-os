import type { ConferenceDeadline } from '../types/conference'
import type { ParsedConferenceDeadline } from './parseConferenceFeed'

/**
 * Upstream change detection (spec §12.8): the previously stored records of one subscription
 * against the freshly parsed snapshot, matched by stable key. Rounds that disappear are reported
 * as `removed` (the caller marks them TBD and keeps the record); rounds that appear are `added`.
 */

export interface FieldChange {
  field: ConferenceChangeField
  previousValue: unknown
  currentValue: unknown
}

export const CONFERENCE_CHANGE_FIELDS = [
  'deadlineAt',
  'timezone',
  'homepageUrl',
  'conferenceDates',
  'location',
  'title',
  'status',
  'round'
] as const
export type ConferenceChangeField = (typeof CONFERENCE_CHANGE_FIELDS)[number]

export const CONFERENCE_CHANGE_LABELS: Readonly<Record<ConferenceChangeField, string>> = {
  deadlineAt: 'Deadline changed',
  timezone: 'Timezone changed',
  homepageUrl: 'Conference website changed',
  conferenceDates: 'Conference dates changed',
  location: 'Location changed',
  title: 'Title changed',
  status: 'Round withdrawn (TBD)',
  round: 'Round added'
}

export interface ChangedRecord {
  existing: ConferenceDeadline
  incoming: ParsedConferenceDeadline
  changes: FieldChange[]
}

export interface SnapshotComparison {
  added: ParsedConferenceDeadline[]
  removed: ConferenceDeadline[]
  changed: ChangedRecord[]
  unchanged: number
}

const same = (a: unknown, b: unknown): boolean => (a ?? null) === (b ?? null)

/** Field-level differences between a stored record and its incoming counterpart. */
export const diffRecord = (
  existing: ConferenceDeadline,
  incoming: ParsedConferenceDeadline
): FieldChange[] => {
  const changes: FieldChange[] = []
  const compare = (
    field: ConferenceChangeField,
    previousValue: unknown,
    currentValue: unknown
  ): void => {
    if (!same(previousValue, currentValue)) changes.push({ field, previousValue, currentValue })
  }
  compare('deadlineAt', existing.deadlineAt, incoming.deadlineAt)
  compare(
    'timezone',
    existing.originalTimezoneLabel ?? existing.originalTimezone,
    incoming.originalTimezoneLabel ?? incoming.originalTimezone
  )
  compare('homepageUrl', existing.homepageUrl, incoming.homepageUrl)
  compare('conferenceDates', existing.conferenceDatesText, incoming.conferenceDatesText)
  compare('location', existing.location, incoming.location)
  compare('title', existing.title, incoming.title)
  // A round that had vanished (TBD) and is back in the feed is a status change too.
  if (existing.status === 'tbd')
    changes.push({ field: 'status', previousValue: 'tbd', currentValue: 'upcoming' })
  return changes
}

export const compareSnapshots = (
  previous: readonly ConferenceDeadline[],
  next: readonly ParsedConferenceDeadline[]
): SnapshotComparison => {
  const previousByKey = new Map(previous.map((record) => [record.stableKey, record]))
  const seen = new Set<string>()
  const result: SnapshotComparison = { added: [], removed: [], changed: [], unchanged: 0 }
  for (const incoming of next) {
    seen.add(incoming.stableKey)
    const existing = previousByKey.get(incoming.stableKey)
    if (!existing) {
      result.added.push(incoming)
      continue
    }
    const changes = diffRecord(existing, incoming)
    if (changes.length > 0) result.changed.push({ existing, incoming, changes })
    else result.unchanged += 1
  }
  for (const record of previous) {
    if (!seen.has(record.stableKey) && record.status !== 'tbd') result.removed.push(record)
  }
  return result
}
