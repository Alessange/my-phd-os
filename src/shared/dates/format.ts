import { DateTime } from 'luxon'
import type { AppSettings } from '../types/settings'
import { isAllDayDate } from './allDay'
import { toZonedDateTime, zoneLabelAt, type ZoneInput } from './instant'
import { resolveZone } from './zones'

/** The subset of settings that influences formatting. */
export type FormatSettings = Pick<AppSettings, 'timezone' | 'dateFormat' | 'clock' | 'weekStartsOn'>

const DATE_TOKENS: Record<Exclude<FormatSettings['dateFormat'], 'system'>, string> = {
  iso: 'yyyy-MM-dd',
  dmy: 'd LLL yyyy',
  mdy: 'LLL d, yyyy'
}

const SEPARATOR = ' · '

const zonedOrDate = (value: string, settings: FormatSettings, zone?: ZoneInput): DateTime =>
  isAllDayDate(value)
    ? DateTime.fromISO(value, { zone: 'utc' })
    : toZonedDateTime(value, zone ?? settings.timezone)

/**
 * Formats an instant (in the display zone) or a `YYYY-MM-DD` date (never zone-shifted).
 * `zone` overrides the settings zone, e.g. to show a deadline in its original zone.
 */
export const formatDate = (value: string, settings: FormatSettings, zone?: ZoneInput): string => {
  const dt = zonedOrDate(value, settings, zone)
  return settings.dateFormat === 'system'
    ? dt.toLocaleString(DateTime.DATE_MED)
    : dt.toFormat(DATE_TOKENS[settings.dateFormat])
}

export const formatTime = (
  instantIso: string,
  settings: FormatSettings,
  zone?: ZoneInput
): string =>
  toZonedDateTime(instantIso, zone ?? settings.timezone).toFormat(
    settings.clock === '12h' ? 'h:mm a' : 'HH:mm'
  )

export const formatDateTime = (
  instantIso: string,
  settings: FormatSettings,
  zone?: ZoneInput
): string =>
  isAllDayDate(instantIso)
    ? formatDate(instantIso, settings)
    : `${formatDate(instantIso, settings, zone)}${SEPARATOR}${formatTime(instantIso, settings, zone)}`

/**
 * Short zone label at a given instant: `PDT`/`PST` for IANA zones, `AoE` for AoE, `UTC-12:00` for
 * other fixed offsets, `UTC` for UTC. Uses the settings zone when `zone` is omitted.
 */
export const formatZoneLabel = (
  zone: ZoneInput | undefined,
  instantIso: string,
  settings?: FormatSettings
): string => {
  const resolved = resolveZone(zone ?? settings?.timezone ?? 'system')
  return zoneLabelAt(resolved, toZonedDateTime(instantIso, resolved))
}

export const formatDateTimeWithZone = (
  instantIso: string,
  settings: FormatSettings,
  zone?: ZoneInput
): string =>
  `${formatDateTime(instantIso, settings, zone)} ${formatZoneLabel(zone, instantIso, settings)}`

export interface DateRangeOptions {
  allDay?: boolean
  /** All-day end dates are exclusive (iCalendar semantics); set to `false` if the end is inclusive. */
  endExclusive?: boolean
}

/**
 * `Sep 18, 2026 · 09:00–10:30` (same day), `Sep 18, 2026 · 23:00 – Sep 19, 2026 · 01:00` (multi-day),
 * `Sep 18, 2026` / `Sep 18 – Sep 20, 2026` style for all-day ranges.
 */
export const formatDateRange = (
  startIso: string,
  endIso: string,
  settings: FormatSettings,
  options: DateRangeOptions = {}
): string => {
  const allDay = options.allDay ?? (isAllDayDate(startIso) && isAllDayDate(endIso))
  if (allDay) {
    const start = DateTime.fromISO(startIso, { zone: 'utc' })
    let end = DateTime.fromISO(endIso, { zone: 'utc' })
    if (options.endExclusive ?? true) end = end.minus({ days: 1 })
    if (end <= start) return formatDate(startIso, settings)
    return `${formatDate(start.toISODate() as string, settings)} – ${formatDate(end.toISODate() as string, settings)}`
  }
  const start = toZonedDateTime(startIso, settings.timezone)
  const end = toZonedDateTime(endIso, settings.timezone)
  if (start.hasSame(end, 'day')) {
    return `${formatDate(startIso, settings)}${SEPARATOR}${formatTime(startIso, settings)}–${formatTime(endIso, settings)}`
  }
  return `${formatDateTime(startIso, settings)} – ${formatDateTime(endIso, settings)}`
}

export const formatWeekday = (
  value: string,
  settings: FormatSettings,
  style: 'long' | 'short' = 'long',
  zone?: ZoneInput
): string => zonedOrDate(value, settings, zone).toFormat(style === 'long' ? 'cccc' : 'ccc')

/** Ordered weekday numbers (ISO, 1 = Monday … 7 = Sunday) starting from the configured first day. */
export const orderedWeekdays = (settings: Pick<FormatSettings, 'weekStartsOn'>): number[] =>
  settings.weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 7] : [7, 1, 2, 3, 4, 5, 6]
