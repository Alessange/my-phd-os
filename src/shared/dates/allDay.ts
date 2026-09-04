import { DateTime } from 'luxon'
import { AppError } from '../errors'
import { toZonedDateTime, type ZoneInput } from './instant'
import { resolveZone } from './zones'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** True for a valid `YYYY-MM-DD` string (no time, no zone). */
export const isAllDayDate = (value: string): boolean =>
  DATE_PATTERN.test(value) && DateTime.fromISO(value, { zone: 'utc' }).isValid

const parseDateKey = (date: string): DateTime => {
  if (!isAllDayDate(date)) throw new AppError('VALIDATION', `Invalid all-day date "${date}"`)
  return DateTime.fromISO(date, { zone: 'utc' })
}

/** Adds whole days to a date key. Pure calendar arithmetic: no zone is involved. */
export const addDays = (date: string, days: number): string =>
  parseDateKey(date).plus({ days }).toISODate() as string

/** Signed number of days from `a` to `b` (`b − a`). */
export const diffDays = (a: string, b: string): number =>
  Math.round(parseDateKey(b).diff(parseDateKey(a), 'days').days)

export const compareDateKeys = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Calendar date of an instant as seen in `zone`. */
export const dateKeyInZone = (instantIso: string, zone: ZoneInput): string =>
  toZonedDateTime(instantIso, zone).toISODate() as string

/** Today's date key in `zone` for the given "now". */
export const todayInZone = (zone: ZoneInput, nowIso: string): string => dateKeyInZone(nowIso, zone)

/** ISO weekday (1 = Monday … 7 = Sunday) of a date key. */
export const weekdayOfDate = (date: string): number => parseDateKey(date).weekday

/** Instant at which the local day `date` starts in `zone` (useful for range queries). */
export const startOfDayInZone = (date: string, zone: ZoneInput): string => {
  parseDateKey(date)
  return DateTime.fromISO(date, { zone: resolveZone(zone).luxonZone })
    .toUTC()
    .toISO() as string
}
