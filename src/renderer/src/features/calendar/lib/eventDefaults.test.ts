import { describe, expect, it } from 'vitest'
import { defaultEventTimes } from './eventDefaults'

const ZONE = 'America/Vancouver'
/** 2026-09-07 is a Monday; PDT is UTC-7, so 07:00 UTC is 00:00 local. */
const atLocalHour = (hour: number, minute = 25): string =>
  new Date(Date.UTC(2026, 8, 7, 7 + hour, minute)).toISOString()

const minutes = (date: string, time: string): number => Date.parse(`${date}T${time}:00Z`) / 60000

describe('defaultEventTimes', () => {
  it.each(Array.from({ length: 24 }, (_, hour) => hour))(
    'gives a one-hour slot that ends after it starts at %i:25 local',
    (hour) => {
      const slot = defaultEventTimes(atLocalHour(hour), ZONE)
      const start = minutes(slot.startDate, slot.startTime)
      const end = minutes(slot.endDate, slot.endTime)
      expect(end - start).toBe(60)
    }
  )

  it('rolls the end date over midnight without moving the start', () => {
    // 22:25 → 23:00-00:00. The end is midnight on the *next* day; keeping the start's date here
    // put the end 23 hours before the start and made the form unsubmittable.
    expect(defaultEventTimes(atLocalHour(22), ZONE)).toEqual({
      startDate: '2026-09-07',
      startTime: '23:00',
      endDate: '2026-09-08',
      endTime: '00:00'
    })
  })

  it('rolls both dates over when the start itself is past midnight', () => {
    expect(defaultEventTimes(atLocalHour(23), ZONE)).toEqual({
      startDate: '2026-09-08',
      startTime: '00:00',
      endDate: '2026-09-08',
      endTime: '01:00'
    })
  })

  it('keeps an ordinary daytime slot on one date', () => {
    expect(defaultEventTimes(atLocalHour(9), ZONE)).toEqual({
      startDate: '2026-09-07',
      startTime: '10:00',
      endDate: '2026-09-07',
      endTime: '11:00'
    })
  })
})
