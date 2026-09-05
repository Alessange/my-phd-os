import type { CalendarEvent, IcsDuplicateReason } from '../types/calendar'
import type { ParsedIcsEvent } from './parse'

/**
 * Duplicate detection for `.ics` import (spec §10.1), most reliable signal first: same UID (and
 * the same recurrence id, when the incoming event is a modified instance), then the same start
 * instant with the same title, then the same start within the target calendar source.
 */

export interface DuplicateMatch {
  /** `ParsedIcsEvent.key` of the incoming event. */
  key: string
  existingEventId: string
  existingTitle: string
  reason: IcsDuplicateReason
}

const normalizeTitle = (title: string): string => title.trim().toLowerCase()

export const detectDuplicates = (
  incoming: readonly ParsedIcsEvent[],
  existing: readonly CalendarEvent[],
  targetSourceId?: string
): DuplicateMatch[] => {
  const byUid = new Map<string, CalendarEvent[]>()
  const byStartTitle = new Map<string, CalendarEvent>()
  const bySourceStart = new Map<string, CalendarEvent>()
  for (const event of existing) {
    if (event.importedUid) {
      const list = byUid.get(event.importedUid) ?? []
      list.push(event)
      byUid.set(event.importedUid, list)
    }
    byStartTitle.set(`${event.startAt}|${normalizeTitle(event.title)}`, event)
    if (event.sourceCalendarId) {
      bySourceStart.set(`${event.sourceCalendarId}|${event.startAt}`, event)
    }
  }

  const matches: DuplicateMatch[] = []
  for (const candidate of incoming) {
    let match: { event: CalendarEvent; reason: IcsDuplicateReason } | undefined
    if (candidate.uid) {
      const sameUid = byUid.get(candidate.uid) ?? []
      const sameInstance = sameUid.find(
        (e) => (e.recurrenceId ?? undefined) === candidate.recurrenceId
      )
      if (sameInstance) {
        match = { event: sameInstance, reason: candidate.recurrenceId ? 'recurrenceId' : 'uid' }
      }
    }
    if (!match) {
      const sameStart = byStartTitle.get(`${candidate.startAt}|${normalizeTitle(candidate.title)}`)
      if (sameStart) match = { event: sameStart, reason: 'startInstant' }
    }
    if (!match && targetSourceId) {
      const sameSource = bySourceStart.get(`${targetSourceId}|${candidate.startAt}`)
      if (sameSource) match = { event: sameSource, reason: 'source' }
    }
    if (match) {
      matches.push({
        key: candidate.key,
        existingEventId: match.event.id,
        existingTitle: match.event.title,
        reason: match.reason
      })
    }
  }
  return matches
}
