import { DateTime } from 'luxon'
import { rrulestr } from 'rrule'
import { addDays, isAllDayDate } from '@shared/dates/allDay'
import { parseInstant, type ZoneInput } from '@shared/dates/instant'
import { resolveZone } from '@shared/dates/zones'
import type { CalendarEvent } from '@shared/types/calendar'

/**
 * Expands stored events into concrete occurrences for a range. Recurrence is evaluated in the
 * event's own zone as wall-clock time (a 10:00 weekly seminar stays at 10:00 across a DST change),
 * then converted to instants; EXDATE / RDATE / modified instances (`recurrenceMasterId`) are
 * honoured. FullCalendar and the Today panel both consume this, so they can never disagree.
 */

export interface Occurrence {
  /** `${event.id}` for single events, `${event.id}@${startAt}` for occurrences of a series. */
  key: string
  event: CalendarEvent
  /** Instant, or `YYYY-MM-DD` when `allDay`. */
  startAt: string
  /** Instant, or exclusive `YYYY-MM-DD` when `allDay`. */
  endAt: string
  allDay: boolean
  /** True for a generated occurrence of a series (not for the master's own row or an override). */
  recurring: boolean
}

export interface OccurrenceRange {
  /** Instants (any offset); all-day occurrences are compared by their dates in `zone`. */
  start: string
  end: string
}

const MAX_OCCURRENCES = 1000
const WALL = "yyyy-MM-dd'T'HH:mm:ss"

/** Wall-clock components of an instant in `zone`, as a floating (UTC-tagged) JS Date for rrule. */
const toWall = (instantIso: string, zone: ZoneInput): Date =>
  DateTime.fromISO(parseInstant(instantIso).setZone(resolveZone(zone).luxonZone).toFormat(WALL), {
    zone: 'utc'
  }).toJSDate()

/** Back from a floating rrule date (wall clock in `zone`) to a canonical instant. */
const fromWall = (wall: Date, zone: ZoneInput): string =>
  DateTime.fromJSDate(wall, { zone: 'utc' })
    .setZone(resolveZone(zone).luxonZone, { keepLocalTime: true })
    .toUTC()
    .toISO() as string

const digits = (value: string): string => value.replace(/[-:]/g, '')

/**
 * Makes the rule's UNTIL floating in the event's zone so it compares against the floating DTSTART
 * rrule sees (a `Z` UNTIL against a floating start is the classic off-by-a-few-hours bug).
 */
const normalizeRule = (rule: string, zone: ZoneInput, allDay: boolean): string =>
  rule.replace(/UNTIL=(\d{8}T\d{6})Z/, (_m, stamp: string) => {
    if (allDay) return `UNTIL=${stamp.slice(0, 8)}`
    const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`
    const wall = DateTime.fromISO(iso, { zone: 'utc' })
      .setZone(resolveZone(zone).luxonZone)
      .toFormat(WALL)
    return `UNTIL=${digits(wall)}`
  })

const durationMs = (event: CalendarEvent): number =>
  event.allDay
    ? 0
    : Math.max(0, parseInstant(event.endAt).toMillis() - parseInstant(event.startAt).toMillis())

const seriesOccurrences = (
  master: CalendarEvent,
  range: OccurrenceRange,
  zone: ZoneInput,
  excluded: ReadonlySet<string>
): Occurrence[] => {
  const out: Occurrence[] = []
  const wallStart = master.allDay
    ? DateTime.fromISO(master.startAt, { zone: 'utc' }).toJSDate()
    : toWall(master.startAt, zone)
  const dtstart = master.allDay
    ? `DTSTART;VALUE=DATE:${digits(master.startAt)}`
    : `DTSTART:${digits(DateTime.fromJSDate(wallStart, { zone: 'utc' }).toFormat(WALL))}`
  const lines = [dtstart]
  if (master.recurrenceRule) {
    lines.push(`RRULE:${normalizeRule(master.recurrenceRule, zone, master.allDay)}`)
  } else {
    // Without an RRULE, rrule does not count DTSTART as an occurrence: add it as an RDATE.
    lines.push(dtstart.replace(/^DTSTART/, 'RDATE'))
  }
  for (const rdate of master.rdates ?? []) {
    lines.push(
      master.allDay || isAllDayDate(rdate)
        ? `RDATE;VALUE=DATE:${digits(rdate.slice(0, 10))}`
        : `RDATE:${digits(DateTime.fromJSDate(toWall(rdate, zone), { zone: 'utc' }).toFormat(WALL))}`
    )
  }
  let set: ReturnType<typeof rrulestr>
  try {
    set = rrulestr(lines.join('\n'), { forceset: true })
  } catch {
    // An unparseable rule shows the master as a single event rather than nothing.
    return []
  }
  // Window in wall-clock frame, widened by the duration so long occurrences overlapping the start count.
  const windowStart = new Date(
    toWall(range.start, zone).getTime() - durationMs(master) - 24 * 3600 * 1000
  )
  const windowEnd = toWall(range.end, zone)
  const dates = set.between(windowStart, windowEnd, true)
  const length = durationMs(master)
  const dayCount = master.allDay
    ? Math.max(1, Math.round((Date.parse(master.endAt) - Date.parse(master.startAt)) / 86_400_000))
    : 0
  for (const date of dates.slice(0, MAX_OCCURRENCES)) {
    if (master.allDay) {
      const day = DateTime.fromJSDate(date, { zone: 'utc' }).toISODate() as string
      if (excluded.has(day)) continue
      out.push({
        key: `${master.id}@${day}`,
        event: master,
        startAt: day,
        endAt: addDays(day, dayCount),
        allDay: true,
        recurring: true
      })
      continue
    }
    const startAt = fromWall(date, zone)
    if (excluded.has(startAt)) continue
    const endAt = DateTime.fromISO(startAt).plus({ milliseconds: length }).toUTC().toISO() as string
    out.push({
      key: `${master.id}@${startAt}`,
      event: master,
      startAt,
      endAt,
      allDay: false,
      recurring: true
    })
  }
  return out
}

const overlapsRange = (
  occurrence: Pick<Occurrence, 'startAt' | 'endAt' | 'allDay'>,
  range: OccurrenceRange,
  zone: ZoneInput
): boolean => {
  if (occurrence.allDay) {
    const rangeStartDay = parseInstant(range.start)
      .setZone(resolveZone(zone).luxonZone)
      .toISODate() as string
    const rangeEndDay = parseInstant(range.end)
      .setZone(resolveZone(zone).luxonZone)
      .toISODate() as string
    return occurrence.startAt < rangeEndDay && occurrence.endAt > rangeStartDay
  }
  return (
    parseInstant(occurrence.startAt).toMillis() < parseInstant(range.end).toMillis() &&
    parseInstant(occurrence.endAt).toMillis() > parseInstant(range.start).toMillis()
  )
}

/** Normalises an exclusion (instant or date) to the frame occurrences are compared in. */
const exclusionKey = (value: string, allDay: boolean): string =>
  allDay || isAllDayDate(value)
    ? value.slice(0, 10)
    : (parseInstant(value).toUTC().toISO() as string)

export const expandOccurrences = (
  events: readonly CalendarEvent[],
  range: OccurrenceRange,
  zone: ZoneInput
): Occurrence[] => {
  const overridesByMaster = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    if (event.recurrenceMasterId) {
      overridesByMaster.set(event.recurrenceMasterId, [
        ...(overridesByMaster.get(event.recurrenceMasterId) ?? []),
        event
      ])
    }
  }
  const out: Occurrence[] = []
  for (const event of events) {
    const isSeries = event.recurrenceRule !== undefined || (event.rdates?.length ?? 0) > 0
    if (isSeries && !event.recurrenceMasterId) {
      const excluded = new Set<string>([
        ...(event.exdates ?? []).map((d) => exclusionKey(d, event.allDay)),
        ...(overridesByMaster.get(event.id) ?? [])
          .map((o) => o.recurrenceId)
          .filter((r): r is string => r !== undefined)
          .map((r) => exclusionKey(r, event.allDay))
      ])
      out.push(
        ...seriesOccurrences(event, range, zone, excluded).filter((o) =>
          overlapsRange(o, range, zone)
        )
      )
      continue
    }
    const single: Occurrence = {
      key: event.id,
      event,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
      recurring: false
    }
    if (overlapsRange(single, range, zone)) out.push(single)
  }
  // Mixed all-day / timed values sort by their real start instant in the display zone.
  return out.sort((a, b) => {
    const sa = occurrenceStartInstant(a, zone)
    const sb = occurrenceStartInstant(b, zone)
    return sa < sb ? -1 : sa > sb ? 1 : a.event.title.localeCompare(b.event.title)
  })
}

/** Instant at which an occurrence begins (all-day: start of its first day in `zone`). */
export const occurrenceStartInstant = (
  occurrence: Pick<Occurrence, 'startAt' | 'allDay'>,
  zone: ZoneInput
): string =>
  occurrence.allDay
    ? (DateTime.fromISO(occurrence.startAt, { zone: resolveZone(zone).luxonZone })
        .toUTC()
        .toISO() as string)
    : occurrence.startAt

/** Instant at which an occurrence ends (all-day: start of the day after its last day in `zone`). */
export const occurrenceEndInstant = (
  occurrence: Pick<Occurrence, 'endAt' | 'allDay'>,
  zone: ZoneInput
): string =>
  occurrence.allDay
    ? (DateTime.fromISO(occurrence.endAt, { zone: resolveZone(zone).luxonZone })
        .toUTC()
        .toISO() as string)
    : occurrence.endAt
