import ICAL from 'ical.js'
import { DateTime } from 'luxon'
import { isAllDayDate } from '../dates/allDay'
import { compareInstants, wallTimeToInstant } from '../dates/instant'
import { tryResolveZone } from '../dates/zones'
import type { ConferenceDeadlineKind } from '../types/conference'
import { stableKeyFor } from './stableKey'

/**
 * Parser for the CCF Deadlines `.ics` feed (spec §12.3, docs/upstream-ccf-feed.md). Everything is
 * read from what the feed carries; nothing is inferred. Times keep their original fixed offset
 * (`UTC-12:00`) as `originalTimezone` and the DESCRIPTION's label (`AoE`) as `originalTimezoneLabel`.
 */

export interface ParsedConferenceDeadline {
  stableKey: string
  upstreamUid?: string
  title: string
  conferenceName?: string
  conferenceYear?: number
  fullName?: string
  /** Subject code from the DESCRIPTION (`AI`), or the raw category text when no code is given. */
  category?: string
  ccfRank?: string
  coreRank?: string
  thcplRank?: string
  deadlineRound?: string
  comment?: string
  location?: string
  conferenceDatesText?: string
  /** Canonical instant; for an all-day deadline the end of that calendar day in UTC. */
  deadlineAt: string
  originalTimezone?: string
  originalTimezoneLabel?: string
  rawDtStart?: string
  homepageUrl?: string
  dblpUrl?: string
  deadlineKind: ConferenceDeadlineKind
  allDay: boolean
  rawIcsData?: string
}

export interface ParsedConferenceFeed {
  deadlines: ParsedConferenceDeadline[]
  warnings: string[]
}

const SUMMARY_PATTERNS: Array<{
  pattern: RegExp
  kind: (label: string) => ConferenceDeadlineKind
}> = [
  {
    pattern: /^(.+?)\s+(\d{4})\s+(Abstract Deadline|Deadline)(?:\s+\[(.*)\])?\s*$/,
    kind: (label) => (label.startsWith('Abstract') ? 'abstract' : 'deadline')
  },
  {
    pattern: /^(.+?)\s+(\d{4})\s+(摘要截稿|截稿日期)(?:\s+\[(.*)\])?\s*$/,
    kind: (label) => (label === '摘要截稿' ? 'abstract' : 'deadline')
  }
]

interface SummaryParts {
  conferenceName?: string
  conferenceYear?: number
  deadlineKind: ConferenceDeadlineKind
  comment?: string
}

export const parseSummary = (summary: string): SummaryParts => {
  for (const { pattern, kind } of SUMMARY_PATTERNS) {
    const match = pattern.exec(summary)
    if (match) {
      return {
        conferenceName: match[1].trim(),
        conferenceYear: Number(match[2]),
        deadlineKind: kind(match[3]),
        comment: match[4]?.trim() || undefined
      }
    }
  }
  const bracket = /^(.*?)\s*\[(.*)\]\s*$/.exec(summary)
  return {
    conferenceName: (bracket ? bracket[1] : summary).trim() || undefined,
    deadlineKind: /abstract|摘要/i.test(summary) ? 'abstract' : 'deadline',
    comment: bracket?.[2]?.trim() || undefined
  }
}

/** Leading emoji / symbols before a label (`🗓️ Date:`). */
const stripLead = (line: string): string => line.replace(/^[^\p{L}\p{N}]+/u, '').trim()

const labelled = (line: string, labels: readonly string[]): string | undefined => {
  const clean = stripLead(line)
  for (const label of labels) {
    if (clean.startsWith(label)) {
      const rest = clean.slice(label.length).replace(/^\s*[:：]\s*/, '')
      return rest.trim()
    }
  }
  return undefined
}

interface DescriptionParts {
  fullName?: string
  conferenceDatesText?: string
  location?: string
  originalTimezoneLabel?: string
  category?: string
  ccfRank?: string
  coreRank?: string
  thcplRank?: string
  homepageUrl?: string
  dblpUrl?: string
}

/** `CCF A, CORE A*, THCPL A` — the star must survive, so no trailing word boundary. */
const RANK_PATTERN = /\b(CCF|CORE|THCPL)\s+([ABC]\*?)(?=[,\s]|$)/g

export const parseDescription = (description: string | undefined): DescriptionParts => {
  const parts: DescriptionParts = {}
  if (!description) return parts
  const lines = description
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return parts
  const [first, ...rest] = lines
  const body = labelled(first, ['Date', '会议时间']) === undefined ? rest : lines
  if (body === rest) parts.fullName = first
  for (const line of body) {
    const date = labelled(line, ['Date', '会议时间'])
    if (date !== undefined) {
      parts.conferenceDatesText = date || undefined
      continue
    }
    const location = labelled(line, ['Location', '会议地点'])
    if (location !== undefined) {
      parts.location = location || undefined
      continue
    }
    const original = /^(?:Original Deadline|原始截止时间)\s*\(([^)]+)\)/.exec(stripLead(line))
    if (original) {
      parts.originalTimezoneLabel = original[1].trim()
      continue
    }
    const category = labelled(line, ['Category', '分类'])
    if (category !== undefined) {
      const code = /\(([A-Z]{2})\)\s*$/.exec(category)
      parts.category = code ? code[1] : category || undefined
      continue
    }
    const homepage = labelled(line, ['Conference Website', '会议官网'])
    if (homepage !== undefined) {
      parts.homepageUrl = homepage || undefined
      continue
    }
    const dblp = labelled(line, ['DBLP Index', 'DBLP索引', 'DBLP'])
    if (dblp !== undefined) {
      parts.dblpUrl = dblp || undefined
      continue
    }
    const ranks = [...stripLead(line).matchAll(RANK_PATTERN)]
    if (ranks.length > 0) {
      for (const [, system, rank] of ranks) {
        if (system === 'CCF') parts.ccfRank = rank
        else if (system === 'CORE') parts.coreRank = rank
        else parts.thcplRank = rank
      }
    }
  }
  return parts
}

const ICAL_LOCAL = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2}))?(Z?)$/

interface DeadlineTime {
  deadlineAt: string
  originalTimezone?: string
  allDay: boolean
}

const deadlineTime = (property: ICAL.Property, time: ICAL.Time): DeadlineTime => {
  const text = time.toString()
  const match = ICAL_LOCAL.exec(text)
  if (!match) throw new Error(`DTSTART is not a valid date-time ("${text}")`)
  const [, date, clock, utcFlag] = match
  if (time.isDate || !clock) {
    if (!isAllDayDate(date)) throw new Error(`DTSTART is not a valid date ("${date}")`)
    // The generator emits a DATE only when upstream gave no time: the deadline is "that day",
    // represented as the end of the day in UTC and flagged all-day so no time or zone is shown.
    return { deadlineAt: `${date}T23:59:59.000Z`, allDay: true }
  }
  const local = `${date}T${clock}`
  if (utcFlag === 'Z' || time.zone === ICAL.Timezone.utcTimezone) {
    const dt = DateTime.fromISO(local, { zone: 'utc' })
    if (!dt.isValid) throw new Error(`DTSTART is not a valid UTC date-time ("${text}")`)
    return { deadlineAt: dt.toISO() as string, originalTimezone: 'UTC', allDay: false }
  }
  const tzidRaw = property.getParameter('tzid')
  const tzid = typeof tzidRaw === 'string' ? tzidRaw.trim() : undefined
  if (!tzid || !tryResolveZone(tzid)) {
    throw new Error(`DTSTART has an unknown or missing timezone ("${tzid ?? 'floating'}")`)
  }
  return { deadlineAt: wallTimeToInstant(local, tzid), originalTimezone: tzid, allDay: false }
}

const firstString = (component: ICAL.Component, name: string): string | undefined => {
  const value = component.getFirstPropertyValue(name)
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text.length > 0 ? text : undefined
}

/**
 * Parses one feed. Invalid VEVENTs are reported in `warnings` and skipped; the rest is kept.
 * Duplicate stable keys inside one snapshot (rare) are disambiguated by deadline order.
 */
export const parseConferenceFeed = (text: string): ParsedConferenceFeed => {
  const warnings: string[] = []
  let calendar: ICAL.Component
  try {
    calendar = new ICAL.Component(ICAL.parse(text))
  } catch (error) {
    throw new Error(
      `The subscription did not return a valid iCalendar feed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  const roots =
    calendar.name === 'vcalendar' ? [calendar] : calendar.getAllSubcomponents('vcalendar')
  if (roots.length === 0) throw new Error('The subscription did not return a VCALENDAR')

  const deadlines: ParsedConferenceDeadline[] = []
  for (const root of roots) {
    for (const vevent of root.getAllSubcomponents('vevent')) {
      const summary = firstString(vevent, 'summary')
      try {
        if (!summary) throw new Error('VEVENT has no SUMMARY')
        const dtstart = vevent.getFirstProperty('dtstart')
        const startValue = dtstart?.getFirstValue()
        if (!dtstart || !(startValue instanceof ICAL.Time)) throw new Error('VEVENT has no DTSTART')
        const time = deadlineTime(dtstart, startValue)
        const parts = parseSummary(summary)
        const details = parseDescription(firstString(vevent, 'description'))
        const conferenceName = parts.conferenceName ?? summary
        deadlines.push({
          stableKey: stableKeyFor({
            conferenceName,
            conferenceYear: parts.conferenceYear,
            deadlineKind: parts.deadlineKind,
            comment: parts.comment
          }),
          upstreamUid: firstString(vevent, 'uid'),
          title: summary,
          conferenceName,
          conferenceYear: parts.conferenceYear,
          fullName: details.fullName,
          category: details.category,
          ccfRank: details.ccfRank,
          coreRank: details.coreRank,
          thcplRank: details.thcplRank,
          deadlineRound:
            parts.comment && /round|submission|cycle|track/i.test(parts.comment)
              ? parts.comment
              : undefined,
          comment: parts.comment,
          location: firstString(vevent, 'location') ?? details.location,
          conferenceDatesText: details.conferenceDatesText,
          deadlineAt: time.deadlineAt,
          originalTimezone: time.originalTimezone,
          originalTimezoneLabel: time.allDay ? undefined : details.originalTimezoneLabel,
          rawDtStart: dtstart.toICALString(),
          homepageUrl: firstString(vevent, 'url') ?? details.homepageUrl,
          dblpUrl: details.dblpUrl,
          deadlineKind: parts.deadlineKind,
          allDay: time.allDay,
          rawIcsData: vevent.toString()
        })
      } catch (error) {
        warnings.push(
          `Skipped ${summary ? `"${summary}"` : 'an event'}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  // Disambiguate identical keys deterministically by deadline instant.
  const groups = new Map<string, ParsedConferenceDeadline[]>()
  for (const deadline of deadlines) {
    groups.set(deadline.stableKey, [...(groups.get(deadline.stableKey) ?? []), deadline])
  }
  for (const [key, group] of groups) {
    if (group.length < 2) continue
    group
      .sort((a, b) => compareInstants(a.deadlineAt, b.deadlineAt))
      .forEach((deadline, index) => {
        if (index > 0) deadline.stableKey = `${key}|${index + 1}`
      })
  }
  return { deadlines, warnings }
}

/** Upstream status from the deadline instant; `tbd` is only ever assigned when a round vanishes. */
export const statusFor = (deadlineAt: string, nowIso: string): 'upcoming' | 'passed' =>
  compareInstants(deadlineAt, nowIso) < 0 ? 'passed' : 'upcoming'
