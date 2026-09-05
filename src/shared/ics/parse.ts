import ICAL from 'ical.js'
import { DateTime } from 'luxon'
import { addDays, isAllDayDate } from '../dates/allDay'
import { wallTimeToInstant } from '../dates/instant'
import { resolveZone, tryResolveZone } from '../dates/zones'
import type { IcsFileInput, IcsImportInvalidFile } from '../types/calendar'

/**
 * Safe `.ics` parsing for import (spec §10). ical.js is lenient by design, so every value is
 * re-validated here: an event with a missing or unparseable DTSTART is reported and skipped, the
 * rest of the file still imports ("partially valid .ics"). Zone handling follows ARCHITECTURE §8:
 * `Z` → UTC instant, `TZID` → resolved (IANA or fixed offset), floating → the import-time app zone.
 * All-day values stay `YYYY-MM-DD` and never pass through a zone.
 */

export interface ParsedIcsEvent {
  /** Stable key within one import: UID (+ recurrence id) when present, else derived from content. */
  key: string
  uid?: string
  title: string
  description?: string
  location?: string
  url?: string
  /** Instant (`…Z`) or `YYYY-MM-DD` when `allDay`. */
  startAt: string
  /** Instant or exclusive `YYYY-MM-DD` when `allDay`. */
  endAt: string
  allDay: boolean
  /** Zone the wall time was interpreted in (IANA name, `UTC`, fixed `UTC-12:00`, or the app zone). */
  timezone: string
  recurrenceRule?: string
  exdates?: string[]
  rdates?: string[]
  /** Overridden occurrence (instant or date) for a modified instance. */
  recurrenceId?: string
  cancelled: boolean
  /** Category written by a previous My PhD OS export (`X-MYPHDOS-CATEGORY`), if any. */
  categoryHint?: string
  fileName: string
}

export interface ParsedIcsInvalidEvent {
  summary?: string
  reason: string
}

export interface ParsedIcsFile {
  name: string
  sizeBytes: number
  events: ParsedIcsEvent[]
  warnings: string[]
  invalidEvents: ParsedIcsInvalidEvent[]
}

export interface IcsParseResult {
  files: ParsedIcsFile[]
  invalidFiles: IcsImportInvalidFile[]
}

export interface IcsParseOptions {
  /** Application timezone at import time; floating and unknown-TZID times are interpreted here. */
  appZone: string
}

interface ConvertedTime {
  value: string
  allDay: boolean
  zone: string
}

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length

const ICAL_LOCAL = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2}))?(Z?)$/

/** Converts one ICAL.Time (with its property's TZID) into a stored value; throws on invalid input. */
const convertTime = (
  property: ICAL.Property,
  time: ICAL.Time,
  appZone: string,
  warnings: string[],
  label: string
): ConvertedTime => {
  const text = time.toString()
  const match = ICAL_LOCAL.exec(text)
  if (!match) throw new Error(`${label} is not a valid date or date-time ("${text}")`)
  const [, date, clock, utcFlag] = match
  if (time.isDate || !clock) {
    if (!isAllDayDate(date)) throw new Error(`${label} is not a valid date ("${date}")`)
    return { value: date, allDay: true, zone: appZone }
  }
  const local = `${date}T${clock}`
  if (utcFlag === 'Z' || time.zone === ICAL.Timezone.utcTimezone) {
    const dt = DateTime.fromISO(local, { zone: 'utc' })
    if (!dt.isValid) throw new Error(`${label} is not a valid UTC date-time ("${text}")`)
    return { value: dt.toISO() as string, allDay: false, zone: 'UTC' }
  }
  const tzidRaw = property.getParameter('tzid')
  const tzid = typeof tzidRaw === 'string' ? tzidRaw.trim() : undefined
  let zone = appZone
  if (tzid) {
    if (tryResolveZone(tzid)) zone = tzid
    else warnings.push(`Unknown timezone "${tzid}" on ${label}; interpreted in ${appZone}`)
  }
  return { value: wallTimeToInstant(local, zone), allDay: false, zone }
}

const timeValues = (property: ICAL.Property): ICAL.Time[] =>
  property.getValues().filter((v): v is ICAL.Time => v instanceof ICAL.Time)

const firstString = (component: ICAL.Component, name: string): string | undefined => {
  const value = component.getFirstPropertyValue(name)
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text.length > 0 ? text : undefined
}

/** Content-derived key for events without a UID (never array position). */
const derivedKey = (
  event: Pick<ParsedIcsEvent, 'title' | 'startAt' | 'endAt' | 'recurrenceId'>
): string =>
  `derived:${event.title.trim().toLowerCase()}|${event.startAt}|${event.endAt}|${event.recurrenceId ?? ''}`

const parseEvent = (
  vevent: ICAL.Component,
  fileName: string,
  appZone: string,
  fileWarnings: string[]
): ParsedIcsEvent => {
  const summary = firstString(vevent, 'summary') ?? '(untitled event)'
  const label = `"${summary}"`
  const dtstart = vevent.getFirstProperty('dtstart')
  const startValue = dtstart?.getFirstValue()
  if (!dtstart || !(startValue instanceof ICAL.Time)) throw new Error(`${label} has no DTSTART`)
  const warnings: string[] = []
  const start = convertTime(dtstart, startValue, appZone, warnings, `DTSTART of ${label}`)

  let end: ConvertedTime | undefined
  const dtend = vevent.getFirstProperty('dtend')
  const endValue = dtend?.getFirstValue()
  if (dtend && endValue instanceof ICAL.Time) {
    end = convertTime(dtend, endValue, appZone, warnings, `DTEND of ${label}`)
  }
  if (!end) {
    const duration = vevent.getFirstPropertyValue('duration')
    if (start.allDay) {
      end = { ...start, value: addDays(start.value, 1) }
    } else if (duration instanceof ICAL.Duration) {
      const dt = DateTime.fromISO(start.value).plus({ seconds: duration.toSeconds() })
      end = { ...start, value: dt.toUTC().toISO() as string }
    } else {
      end = { ...start }
    }
  }
  if (start.allDay !== end.allDay) {
    // A DATE start with a DATE-TIME end (or vice versa) is malformed; keep the start's kind.
    warnings.push(
      `${label} mixes all-day and timed values; treated as ${start.allDay ? 'all-day' : 'timed'}`
    )
    end = start.allDay ? { ...start, value: addDays(start.value, 1) } : { ...start }
  }
  if (start.allDay ? end.value <= start.value : end.value < start.value) {
    warnings.push(`${label} ends before it starts; end set to its start`)
    end = start.allDay ? { ...start, value: addDays(start.value, 1) } : { ...start }
  }

  // Raw RRULE text preserves the upstream part order (ical.js reorders when re-serialising).
  const rruleProperty = vevent.getFirstProperty('rrule')
  const recurrenceRule = rruleProperty
    ? rruleProperty
        .toICALString()
        .replace(/^RRULE:/i, '')
        .trim() || undefined
    : undefined
  const exdates = vevent
    .getAllProperties('exdate')
    .flatMap((p) =>
      timeValues(p).map((t) => convertTime(p, t, appZone, warnings, `EXDATE of ${label}`).value)
    )
  const rdates = vevent
    .getAllProperties('rdate')
    .flatMap((p) =>
      timeValues(p).map((t) => convertTime(p, t, appZone, warnings, `RDATE of ${label}`).value)
    )

  const rid = vevent.getFirstProperty('recurrence-id')
  const ridValue = rid?.getFirstValue()
  const recurrenceId =
    rid && ridValue instanceof ICAL.Time
      ? convertTime(rid, ridValue, appZone, warnings, `RECURRENCE-ID of ${label}`).value
      : undefined

  const uid = firstString(vevent, 'uid')
  const status = firstString(vevent, 'status')?.toUpperCase()
  const base = {
    title: summary,
    startAt: start.value,
    endAt: end.value,
    recurrenceId
  }
  fileWarnings.push(...warnings)
  return {
    key: uid ? (recurrenceId ? `${uid}@${recurrenceId}` : uid) : derivedKey(base),
    uid,
    ...base,
    description: firstString(vevent, 'description'),
    location: firstString(vevent, 'location'),
    url: firstString(vevent, 'url'),
    allDay: start.allDay,
    timezone: start.zone,
    recurrenceRule,
    exdates: exdates.length > 0 ? exdates : undefined,
    rdates: rdates.length > 0 ? rdates : undefined,
    cancelled: status === 'CANCELLED',
    categoryHint: firstString(vevent, 'x-myphdos-category'),
    fileName
  }
}

const parseFile = (
  file: IcsFileInput,
  options: IcsParseOptions
): ParsedIcsFile | IcsImportInvalidFile => {
  const appZone = resolveZone(options.appZone).label === 'system' ? 'UTC' : options.appZone
  let calendar: ICAL.Component
  try {
    const jcal = ICAL.parse(file.text)
    calendar = new ICAL.Component(jcal)
  } catch (error) {
    return {
      name: file.name,
      reason: `Not a valid iCalendar file: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  const components =
    calendar.name === 'vcalendar'
      ? [calendar]
      : calendar.getAllSubcomponents('vcalendar').length > 0
        ? calendar.getAllSubcomponents('vcalendar')
        : []
  if (components.length === 0) {
    return { name: file.name, reason: 'No VCALENDAR component found' }
  }
  const warnings: string[] = []
  const invalidEvents: ParsedIcsInvalidEvent[] = []
  const events: ParsedIcsEvent[] = []
  for (const component of components) {
    for (const vevent of component.getAllSubcomponents('vevent')) {
      try {
        events.push(parseEvent(vevent, file.name, appZone, warnings))
      } catch (error) {
        invalidEvents.push({
          summary: firstString(vevent, 'summary'),
          reason: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }
  if (events.length === 0 && invalidEvents.length === 0) {
    warnings.push('The file contains no events')
  }
  return { name: file.name, sizeBytes: utf8Bytes(file.text), events, warnings, invalidEvents }
}

const isInvalidFile = (
  value: ParsedIcsFile | IcsImportInvalidFile
): value is IcsImportInvalidFile => 'reason' in value

/** Parses every file independently: one broken file never blocks the others. */
export const parseIcsFiles = (
  files: readonly IcsFileInput[],
  options: IcsParseOptions
): IcsParseResult => {
  const result: IcsParseResult = { files: [], invalidFiles: [] }
  for (const file of files) {
    const parsed = parseFile(file, options)
    if (isInvalidFile(parsed)) result.invalidFiles.push(parsed)
    else result.files.push(parsed)
  }
  return result
}

/** Earliest start and latest end over all parsed events (mixed all-day / timed), as stored values. */
export const parsedDateRange = (
  events: readonly ParsedIcsEvent[]
): { start: string; end: string } | undefined => {
  let start: ParsedIcsEvent | undefined
  let end: ParsedIcsEvent | undefined
  const ms = (value: string): number => DateTime.fromISO(value, { zone: 'utc' }).toMillis()
  for (const event of events) {
    if (!start || ms(event.startAt) < ms(start.startAt)) start = event
    if (!end || ms(event.endAt) > ms(end.endAt)) end = event
  }
  return start && end ? { start: start.startAt, end: end.endAt } : undefined
}
