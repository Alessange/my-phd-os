import { addDays } from '@shared/dates/allDay'
import { instantToWallTime } from '@shared/dates/instant'

export interface DefaultEventTimes {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

/**
 * Default slot for a new event: the next full hour in `zone`, one hour long.
 *
 * Both ends can cross midnight and each needs its own date. Deriving the end date from the start
 * date is wrong for exactly one hour of the day — at 22:xx the start rolls to 23:00 and the end
 * wraps to 00:00, which on the start's date is twenty-three hours *earlier*, so the form refuses
 * to submit and a new event cannot be created at all.
 */
export const defaultEventTimes = (nowIso: string, zone: string): DefaultEventTimes => {
  const wall = instantToWallTime(nowIso, zone)
  const pad = (n: number): string => String(n).padStart(2, '0')
  const startHour = (Number(wall.time.slice(0, 2)) + 1) % 24
  const endHour = (startHour + 1) % 24
  const startDate = startHour === 0 ? addDays(wall.date, 1) : wall.date
  return {
    startDate,
    startTime: `${pad(startHour)}:00`,
    endDate: endHour === 0 ? addDays(startDate, 1) : startDate,
    endTime: `${pad(endHour)}:00`
  }
}
