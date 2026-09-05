import { useMemo } from 'react'
import {
  calculateRemainingTime,
  formatCountdown,
  formatRelative,
  type CountdownStyle
} from '@shared/dates/countdown'
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDateTimeWithZone,
  formatTime,
  formatWeekday,
  formatZoneLabel,
  orderedWeekdays,
  type DateRangeOptions,
  type FormatSettings
} from '@shared/dates/format'
import { instantToWallTime, type ZoneInput } from '@shared/dates/instant'
import { resolveZone, tryResolveZone, type ResolvedZone } from '@shared/dates/zones'
import { useSettings } from './useSettings'

export interface Formatters {
  settings: FormatSettings
  /** The resolved display zone (`system` → host IANA zone). */
  zone: ResolvedZone
  /** Setting label: `System timezone (America/Vancouver)`, `AoE`, `Europe/Paris`. */
  zoneName: string
  formatDate: (value: string, zone?: ZoneInput) => string
  formatTime: (instantIso: string, zone?: ZoneInput) => string
  /** Wall-clock with seconds, honouring the 12h/24h setting: `14:05:09` / `2:05:09 PM`. */
  formatClock: (instantIso: string, zone?: ZoneInput) => string
  formatDateTime: (instantIso: string, zone?: ZoneInput) => string
  formatDateTimeWithZone: (instantIso: string, zone?: ZoneInput) => string
  formatZoneLabel: (instantIso: string, zone?: ZoneInput) => string
  formatWeekday: (value: string, style?: 'long' | 'short', zone?: ZoneInput) => string
  formatDateRange: (startIso: string, endIso: string, options?: DateRangeOptions) => string
  formatRelative: (targetIso: string, nowIso: string) => string
  formatCountdown: (targetIso: string, nowIso: string, style?: CountdownStyle) => string
  orderedWeekdays: () => number[]
}

export const buildFormatters = (settings: FormatSettings): Formatters => {
  const zone = tryResolveZone(settings.timezone) ?? resolveZone('system')
  const zoneName =
    settings.timezone === 'system' ? `System timezone (${zone.ianaName ?? zone.label})` : zone.label
  const formatClock = (instantIso: string, z?: ZoneInput): string => {
    const wall = instantToWallTime(instantIso, z ?? zone)
    const seconds = wall.localIso.slice(17, 19)
    if (settings.clock === '24h') return `${wall.time}:${seconds}`
    const [time, meridiem] = formatTime(instantIso, settings, z ?? zone).split(' ')
    return `${time}:${seconds} ${meridiem}`
  }
  return {
    settings,
    zone,
    zoneName,
    formatDate: (value, z) => formatDate(value, settings, z ?? zone),
    formatTime: (instantIso, z) => formatTime(instantIso, settings, z ?? zone),
    formatClock,
    formatDateTime: (instantIso, z) => formatDateTime(instantIso, settings, z ?? zone),
    formatDateTimeWithZone: (instantIso, z) =>
      formatDateTimeWithZone(instantIso, settings, z ?? zone),
    formatZoneLabel: (instantIso, z) => formatZoneLabel(z ?? zone, instantIso, settings),
    formatWeekday: (value, style = 'long', z) => formatWeekday(value, settings, style, z ?? zone),
    formatDateRange: (startIso, endIso, options) =>
      formatDateRange(
        startIso,
        endIso,
        { ...settings, timezone: zone.ianaName ?? zone.label },
        options
      ),
    formatRelative,
    formatCountdown: (targetIso, nowIso, style = 'long') =>
      formatCountdown(calculateRemainingTime(targetIso, nowIso), { style }),
    orderedWeekdays: () => orderedWeekdays(settings)
  }
}

/** Formatters bound to the current settings and display zone. Components never call Luxon directly. */
export const useFormat = (): Formatters => {
  const { settings } = useSettings()
  const { timezone, dateFormat, clock, weekStartsOn } = settings
  return useMemo(
    () => buildFormatters({ timezone, dateFormat, clock, weekStartsOn }),
    [timezone, dateFormat, clock, weekStartsOn]
  )
}
