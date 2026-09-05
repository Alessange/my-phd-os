import { getCategory } from '../constants/categories'
import { isAllDayDate } from '../dates/allDay'
import { instantToWallTime, parseInstant } from '../dates/instant'
import { tryResolveZone } from '../dates/zones'
import type { CalendarEvent } from '../types/calendar'

/**
 * `.ics` export (spec §10.3). Hand-written RFC 5545 output: UID, title, description, location,
 * start/end, timezone, all-day state, recurrence (RRULE / EXDATE / RDATE / RECURRENCE-ID), status
 * and URL are preserved. Timed values in an IANA zone are written as local wall time with `TZID`;
 * fixed-offset zones (`UTC-12:00`, AoE) are written as UTC instants because no consumer knows those
 * TZIDs. All-day values are `VALUE=DATE` and never pass through a zone.
 */

export interface SerializeIcsOptions {
  /** `X-WR-CALNAME`; omitted when undefined. */
  calendarName?: string
  /** DTSTAMP for every event; defaults to now. */
  nowIso?: string
  prodId?: string
}

const PROD_ID = '-//My PhD OS//Calendar//EN'
const FOLD_OCTETS = 75

const encoder = new TextEncoder()

const escapeText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Folds a content line at 75 octets with a CRLF + single space continuation (RFC 5545 §3.1). */
export const foldLine = (line: string): string => {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    const limit = out.length === 0 ? FOLD_OCTETS : FOLD_OCTETS - 1
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  out.push(current)
  return out.map((part, index) => (index === 0 ? part : ` ${part}`)).join('\r\n')
}

const digits = (value: string): string => value.replace(/[-:]/g, '')

/** `20260916T150000Z` for an instant. */
const utcStamp = (instantIso: string): string =>
  `${digits(parseInstant(instantIso).toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss"))}Z`

interface TimeProperty {
  params: string
  value: string
}

/** How a stored value is written: all-day as DATE, IANA zones as local + TZID, else UTC. */
const timeProperty = (value: string, allDay: boolean, timezone: string): TimeProperty => {
  if (allDay || isAllDayDate(value)) return { params: ';VALUE=DATE', value: digits(value) }
  const zone = tryResolveZone(timezone)
  if (zone?.kind === 'iana' && zone.ianaName) {
    const wall = instantToWallTime(value, zone)
    return { params: `;TZID=${zone.ianaName}`, value: digits(wall.localIso) }
  }
  return { params: '', value: utcStamp(value) }
}

const line = (name: string, value: string | undefined): string[] =>
  value === undefined || value === '' ? [] : [foldLine(`${name}:${value}`)]

const timeLine = (name: string, value: string, allDay: boolean, timezone: string): string => {
  const prop = timeProperty(value, allDay, timezone)
  return foldLine(`${name}${prop.params}:${prop.value}`)
}

const timeListLine = (
  name: string,
  values: readonly string[] | undefined,
  allDay: boolean,
  timezone: string
): string[] => {
  if (!values || values.length === 0) return []
  const props = values.map((value) => timeProperty(value, allDay, timezone))
  // All values in one EXDATE/RDATE line share one form; mixed forms are split into separate lines.
  const groups = new Map<string, string[]>()
  for (const prop of props)
    groups.set(prop.params, [...(groups.get(prop.params) ?? []), prop.value])
  return [...groups].map(([params, list]) => foldLine(`${name}${params}:${list.join(',')}`))
}

/** UID written for an event: the imported UID when it came from a file, else the local id. */
export const exportUid = (event: Pick<CalendarEvent, 'id' | 'importedUid'>): string =>
  event.importedUid ?? `${event.id}@my-phd-os`

export const serializeEvent = (event: CalendarEvent, nowIso: string): string[] => {
  const lines: string[] = ['BEGIN:VEVENT']
  lines.push(...line('UID', exportUid(event)))
  lines.push(`DTSTAMP:${utcStamp(nowIso)}`)
  lines.push(timeLine('DTSTART', event.startAt, event.allDay, event.timezone))
  lines.push(timeLine('DTEND', event.endAt, event.allDay, event.timezone))
  lines.push(...line('SUMMARY', escapeText(event.title)))
  lines.push(...line('DESCRIPTION', event.description ? escapeText(event.description) : undefined))
  lines.push(...line('LOCATION', event.location ? escapeText(event.location) : undefined))
  lines.push(...line('URL', event.url))
  lines.push(...line('RRULE', event.recurrenceRule))
  lines.push(...timeListLine('EXDATE', event.exdates, event.allDay, event.timezone))
  lines.push(...timeListLine('RDATE', event.rdates, event.allDay, event.timezone))
  if (event.recurrenceId) {
    lines.push(
      timeLine(
        'RECURRENCE-ID',
        event.recurrenceId,
        isAllDayDate(event.recurrenceId),
        event.timezone
      )
    )
  }
  lines.push(`STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`)
  lines.push(...line('CATEGORIES', escapeText(getCategory(event.category).label)))
  lines.push(...line('X-MYPHDOS-CATEGORY', event.category))
  lines.push(...line('X-MYPHDOS-TIMEZONE', event.timezone))
  if (event.sourceManaged) lines.push('X-MYPHDOS-SOURCE-MANAGED:TRUE')
  lines.push(
    ...line('X-MYPHDOS-SOURCE-LABEL', event.sourceLabel ? escapeText(event.sourceLabel) : undefined)
  )
  lines.push(`CREATED:${utcStamp(event.createdAt)}`)
  lines.push(`LAST-MODIFIED:${utcStamp(event.updatedAt)}`)
  lines.push('END:VEVENT')
  return lines
}

export const serializeIcs = (
  events: readonly CalendarEvent[],
  options: SerializeIcsOptions = {}
): string => {
  const nowIso = options.nowIso ?? new Date().toISOString()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${options.prodId ?? PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ]
  lines.push(
    ...line('X-WR-CALNAME', options.calendarName ? escapeText(options.calendarName) : undefined)
  )
  for (const event of events) lines.push(...serializeEvent(event, nowIso))
  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
