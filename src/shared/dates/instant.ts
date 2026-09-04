import { DateTime } from 'luxon'
import { AppError } from '../errors'
import { resolveZone, type ResolvedZone } from './zones'

export type ZoneInput = string | ResolvedZone

export const nowIso = (): string => new Date().toISOString()

/** Parses a canonical instant; throws `AppError('VALIDATION')` when the string is not a valid ISO date-time. */
export const parseInstant = (instantIso: string): DateTime => {
  const dt = DateTime.fromISO(instantIso, { setZone: true })
  if (!dt.isValid) {
    throw new AppError(
      'VALIDATION',
      `Invalid instant "${instantIso}": ${dt.invalidExplanation ?? dt.invalidReason}`
    )
  }
  return dt
}

export const isValidInstant = (value: string): boolean => DateTime.fromISO(value).isValid

/** Returns the instant as a Luxon DateTime expressed in the given zone. */
export const toZonedDateTime = (instantIso: string, zone: ZoneInput): DateTime =>
  parseInstant(instantIso).setZone(resolveZone(zone).luxonZone)

/**
 * Interprets a wall-clock time (`2026-09-18T23:59` / `2026-09-18T23:59:00`) in `zone` and returns the
 * canonical UTC instant. A string that already carries an offset or `Z` is treated as an absolute instant.
 * Nonexistent wall times inside a DST gap are shifted forward by Luxon; ambiguous ones take the earlier offset.
 */
export const wallTimeToInstant = (localIso: string, zone: ZoneInput): string => {
  const dt = DateTime.fromISO(localIso, { zone: resolveZone(zone).luxonZone })
  if (!dt.isValid) {
    throw new AppError(
      'VALIDATION',
      `Invalid wall time "${localIso}": ${dt.invalidExplanation ?? dt.invalidReason}`
    )
  }
  return dt.toUTC().toISO() as string
}

export interface WallTime {
  /** `YYYY-MM-DDTHH:mm:ss` without offset. */
  localIso: string
  date: string
  time: string
  offsetMinutes: number
  /** Short zone name at that instant: `PDT`, `PST`, `UTC-12:00`, `AoE`. */
  zoneLabel: string
}

/** Converts a canonical instant into wall-clock components in `zone`. */
export const instantToWallTime = (instantIso: string, zone: ZoneInput): WallTime => {
  const resolved = resolveZone(zone)
  const dt = toZonedDateTime(instantIso, resolved)
  return {
    localIso: dt.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
    date: dt.toISODate() as string,
    time: dt.toFormat('HH:mm'),
    offsetMinutes: dt.offset,
    zoneLabel: zoneLabelAt(resolved, dt)
  }
}

/** Short label for a zone at a given moment: IANA zones use their abbreviation, fixed zones their label. */
export const zoneLabelAt = (zone: ResolvedZone, at: DateTime): string => {
  if (zone.kind !== 'iana') return zone.label
  const name = at.setZone(zone.luxonZone).offsetNameShort
  return name && name !== '' ? name : zone.label
}

export const compareInstants = (a: string, b: string): number =>
  parseInstant(a).toMillis() - parseInstant(b).toMillis()
