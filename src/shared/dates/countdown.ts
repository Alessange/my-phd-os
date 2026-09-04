import { parseInstant } from './instant'

export const MS_PER_SECOND = 1000
export const MS_PER_MINUTE = 60 * MS_PER_SECOND
export const MS_PER_HOUR = 60 * MS_PER_MINUTE
export const MS_PER_DAY = 24 * MS_PER_HOUR

export interface RemainingTime {
  /** Signed milliseconds until the target (negative once passed). */
  totalMs: number
  isPast: boolean
  /** True when the target is in the future and less than 24 hours away. */
  isUnder24h: boolean
  /** Absolute components of `|totalMs|`. */
  days: number
  hours: number
  minutes: number
  seconds: number
}

export const calculateRemainingTime = (targetIso: string, nowIso: string): RemainingTime => {
  const totalMs = parseInstant(targetIso).toMillis() - parseInstant(nowIso).toMillis()
  const abs = Math.abs(totalMs)
  const isPast = totalMs < 0
  return {
    totalMs,
    isPast,
    isUnder24h: !isPast && totalMs < MS_PER_DAY,
    days: Math.floor(abs / MS_PER_DAY),
    hours: Math.floor((abs % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((abs % MS_PER_HOUR) / MS_PER_MINUTE),
    seconds: Math.floor((abs % MS_PER_MINUTE) / MS_PER_SECOND)
  }
}

export type CountdownStyle = 'long' | 'compact' | 'stacked'

export interface CountdownSegment {
  value: string
  unit: 'day' | 'hour' | 'minute' | 'second'
  label: string
}

const pad2 = (n: number): string => String(n).padStart(2, '0')
const plural = (n: number, unit: string): string => `${unit}${n === 1 ? '' : 's'}`

/**
 * Segments to display for a future remaining time. With a day or more left: days, hours, minutes.
 * Under 24 h: hours, minutes, seconds (so the UI can emphasise hours and minutes).
 */
export const countdownSegments = (remaining: RemainingTime): CountdownSegment[] => {
  const { days, hours, minutes, seconds } = remaining
  if (days > 0) {
    return [
      { value: String(days), unit: 'day', label: plural(days, 'day') },
      { value: pad2(hours), unit: 'hour', label: plural(hours, 'hour') },
      { value: pad2(minutes), unit: 'minute', label: plural(minutes, 'minute') }
    ]
  }
  return [
    { value: pad2(hours), unit: 'hour', label: plural(hours, 'hour') },
    { value: pad2(minutes), unit: 'minute', label: plural(minutes, 'minute') },
    { value: pad2(seconds), unit: 'second', label: plural(seconds, 'second') }
  ]
}

const COMPACT_UNIT: Record<CountdownSegment['unit'], string> = {
  day: 'd',
  hour: 'h',
  minute: 'm',
  second: 's'
}

/** Coarsest non-zero unit of a past duration, e.g. `2 days`, `3 hours`, `5 minutes`. */
const elapsedPhrase = (remaining: RemainingTime, compact: boolean): string => {
  const { days, hours, minutes } = remaining
  const [n, unit]: [number, CountdownSegment['unit']] =
    days > 0 ? [days, 'day'] : hours > 0 ? [hours, 'hour'] : [Math.max(minutes, 1), 'minute']
  return compact ? `${n}${COMPACT_UNIT[unit]}` : `${n} ${plural(n, unit)}`
}

/**
 * `long`:    `32 days 08 hours 14 minutes` · under 24 h `08 hours 14 minutes 09 seconds` · `Passed 2 days ago`
 * `compact`: `32d 08h` · under 24 h `08h 14m` · under 1 h `14m 09s` · `Passed 2d ago`
 * `stacked`: same segments as `long`, one per line (`32 days\n08 hours\n14 minutes`).
 */
export const formatCountdown = (
  remaining: RemainingTime,
  options: { style: CountdownStyle } = { style: 'long' }
): string => {
  const { style } = options
  if (remaining.isPast) {
    if (remaining.totalMs > -MS_PER_MINUTE) return 'Passed just now'
    return `Passed ${elapsedPhrase(remaining, style === 'compact')} ago`
  }
  const segments = countdownSegments(remaining)
  if (style === 'compact') {
    const shown =
      remaining.days > 0 || remaining.hours > 0 ? segments.slice(0, 2) : segments.slice(1, 3)
    return shown.map((s) => `${s.value}${COMPACT_UNIT[s.unit]}`).join(' ')
  }
  const parts = segments.map((s) => `${s.value} ${s.label}`)
  return parts.join(style === 'stacked' ? '\n' : ' ')
}

/** Coarse relative phrase: `in 3 days`, `in 5 hours`, `in 12 minutes`, `just now`, `2 days ago`. */
export const formatRelative = (targetIso: string, nowIso: string): string => {
  const remaining = calculateRemainingTime(targetIso, nowIso)
  if (Math.abs(remaining.totalMs) < MS_PER_MINUTE) return 'just now'
  const phrase = elapsedPhrase(remaining, false)
  return remaining.isPast ? `${phrase} ago` : `in ${phrase}`
}
