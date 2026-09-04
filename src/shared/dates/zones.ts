import { FixedOffsetZone, IANAZone, type Zone } from 'luxon'
import { AppError } from '../errors'

export type ZoneKind = 'iana' | 'fixed' | 'utc'

export interface ResolvedZone {
  kind: ZoneKind
  luxonZone: Zone
  /** Human label for the zone as entered: `AoE`, `PT`, `UTC-08:00`, `America/Los_Angeles`, `UTC`. */
  label: string
  ianaName?: string
  /** Fixed offset in minutes east of UTC (only for `fixed` and `utc`). */
  offsetMinutes?: number
}

export const ZONE_ALIASES: Readonly<Record<string, string>> = {
  PT: 'America/Los_Angeles',
  ET: 'America/New_York',
  CT: 'America/Chicago',
  MT: 'America/Denver'
}

export const AOE_LABEL = 'AoE'
export const AOE_OFFSET_MINUTES = -12 * 60

const FIXED_OFFSET_PATTERN = /^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i
const MIN_OFFSET_MINUTES = -12 * 60
const MAX_OFFSET_MINUTES = 14 * 60

const pad = (n: number): string => String(n).padStart(2, '0')

/** Formats an offset in minutes as `UTC+08:00` / `UTC-12:00`. */
export const formatOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

export const systemZoneName = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone

const utcZone = (label = 'UTC'): ResolvedZone => ({
  kind: 'utc',
  luxonZone: FixedOffsetZone.utcInstance,
  label,
  offsetMinutes: 0
})

const fixedZone = (offsetMinutes: number, label = formatOffset(offsetMinutes)): ResolvedZone =>
  offsetMinutes === 0
    ? utcZone(label)
    : { kind: 'fixed', luxonZone: FixedOffsetZone.instance(offsetMinutes), label, offsetMinutes }

const ianaZone = (name: string, label = name): ResolvedZone => ({
  kind: 'iana',
  luxonZone: IANAZone.create(name),
  label,
  ianaName: name
})

const parseFixedOffset = (input: string): number | undefined => {
  const match = FIXED_OFFSET_PATTERN.exec(input)
  if (!match) return undefined
  const [, sign, hours, minutes = '00'] = match
  const total = Number(hours) * 60 + Number(minutes)
  const signed = sign === '-' ? -total : total
  if (Number(minutes) > 59 || signed < MIN_OFFSET_MINUTES || signed > MAX_OFFSET_MINUTES) {
    return undefined
  }
  return signed
}

/**
 * Resolves a user- or source-supplied zone string. Accepts `'system'`, IANA names, `'UTC'`, `'AoE'`
 * (fixed UTC−12), `'PT'`/`'ET'` (DST-aware IANA aliases) and fixed offsets such as `'UTC-8'`,
 * `'UTC-08:00'`, `'UTC+5:30'`, `'GMT+8'`. Unknown input throws `AppError('VALIDATION')`.
 */
export const resolveZone = (input: string | ResolvedZone): ResolvedZone => {
  if (typeof input !== 'string') return input
  const trimmed = input.trim()
  if (trimmed === '') throw new AppError('VALIDATION', 'Timezone must not be empty')
  if (trimmed === 'system') return ianaZone(systemZoneName())
  if (/^(utc|gmt|z|etc\/utc|etc\/gmt)$/i.test(trimmed)) return utcZone()
  if (trimmed.toLowerCase() === AOE_LABEL.toLowerCase())
    return fixedZone(AOE_OFFSET_MINUTES, AOE_LABEL)

  const alias = ZONE_ALIASES[trimmed.toUpperCase()]
  if (alias) return ianaZone(alias, trimmed.toUpperCase())

  const offset = parseFixedOffset(trimmed)
  if (offset !== undefined) return fixedZone(offset)

  if (IANAZone.isValidZone(trimmed)) return ianaZone(trimmed)

  throw new AppError('VALIDATION', `Unknown timezone "${input}"`, { input })
}

export const tryResolveZone = (input: string): ResolvedZone | undefined => {
  try {
    return resolveZone(input)
  } catch (error) {
    if (error instanceof AppError && error.code === 'VALIDATION') return undefined
    throw error
  }
}

export const isValidZoneInput = (input: string): boolean => tryResolveZone(input) !== undefined
