import { describe, expect, it } from 'vitest'
import { AppError } from '../errors'
import {
  formatOffset,
  isValidZoneInput,
  resolveZone,
  systemZoneName,
  tryResolveZone
} from './zones'

describe('resolveZone', () => {
  it('maps AoE to a fixed UTC−12 zone labelled AoE', () => {
    const zone = resolveZone('AoE')
    expect(zone.kind).toBe('fixed')
    expect(zone.label).toBe('AoE')
    expect(zone.offsetMinutes).toBe(-720)
    expect(zone.luxonZone.offset(Date.UTC(2026, 6, 1))).toBe(-720)
    expect(resolveZone('aoe').label).toBe('AoE')
  })

  it('maps PT and ET to DST-aware IANA zones', () => {
    const pt = resolveZone('PT')
    expect(pt).toMatchObject({ kind: 'iana', ianaName: 'America/Los_Angeles', label: 'PT' })
    expect(pt.luxonZone.offset(Date.UTC(2026, 6, 1))).toBe(-420)
    expect(pt.luxonZone.offset(Date.UTC(2026, 0, 1))).toBe(-480)
    expect(resolveZone('ET').ianaName).toBe('America/New_York')
  })

  it.each([
    ['UTC-8', -480, 'UTC-08:00'],
    ['UTC-08:00', -480, 'UTC-08:00'],
    ['UTC+5:30', 330, 'UTC+05:30'],
    ['GMT+8', 480, 'UTC+08:00'],
    ['UTC-12:00', -720, 'UTC-12:00'],
    ['UTC+14', 840, 'UTC+14:00']
  ])('parses fixed offset %s', (input, offset, label) => {
    const zone = resolveZone(input)
    expect(zone.kind).toBe('fixed')
    expect(zone.offsetMinutes).toBe(offset)
    expect(zone.label).toBe(label)
    expect(zone.luxonZone.offset(Date.UTC(2026, 0, 1))).toBe(offset)
  })

  it('treats UTC and zero offsets as utc', () => {
    for (const input of ['UTC', 'utc', 'Z', 'UTC+0', 'UTC+00:00', 'GMT+0', 'Etc/UTC']) {
      const zone = resolveZone(input)
      expect(zone.kind).toBe('utc')
      expect(zone.offsetMinutes).toBe(0)
    }
    expect(resolveZone('UTC').label).toBe('UTC')
  })

  it('passes valid IANA names through', () => {
    const zone = resolveZone('Asia/Kolkata')
    expect(zone).toMatchObject({ kind: 'iana', ianaName: 'Asia/Kolkata', label: 'Asia/Kolkata' })
    expect(zone.luxonZone.offset(Date.UTC(2026, 0, 1))).toBe(330)
  })

  it('resolves system to the host IANA zone', () => {
    const zone = resolveZone('system')
    expect(zone.kind).toBe('iana')
    expect(zone.ianaName).toBe(systemZoneName())
  })

  it('returns an already-resolved zone unchanged', () => {
    const zone = resolveZone('AoE')
    expect(resolveZone(zone)).toBe(zone)
  })

  it.each(['', '   ', 'Mars/Olympus', 'UTC+15', 'UTC-13', 'UTC+5:75', 'PST8PDT-ish', 'tomorrow'])(
    'rejects unknown input %j with a VALIDATION error',
    (input) => {
      expect(() => resolveZone(input)).toThrow(AppError)
      try {
        resolveZone(input)
      } catch (error) {
        expect((error as AppError).code).toBe('VALIDATION')
      }
      expect(tryResolveZone(input)).toBeUndefined()
      expect(isValidZoneInput(input)).toBe(false)
    }
  )
})

describe('formatOffset', () => {
  it('formats signed offsets with zero padding', () => {
    expect(formatOffset(-720)).toBe('UTC-12:00')
    expect(formatOffset(330)).toBe('UTC+05:30')
    expect(formatOffset(0)).toBe('UTC+00:00')
  })
})
