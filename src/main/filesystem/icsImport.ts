import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import {
  CALENDAR_EVENT_CATEGORIES,
  type CalendarEvent,
  type CalendarEventCategory,
  type IcsExportScope,
  type IcsImportPreview,
  type IcsImportPreviewEvent,
  type IcsImportResult
} from '@shared/types/calendar'
import { AppError } from '@shared/errors'
import { detectDuplicates, type DuplicateMatch } from '@shared/ics/duplicates'
import {
  parseIcsFiles,
  parsedDateRange,
  type ParsedIcsEvent,
  type ParsedIcsFile
} from '@shared/ics/parse'
import { serializeIcs } from '@shared/ics/serialize'
import type { CommitIcsImportRequest, PreviewIcsImportRequest } from '@shared/schemas/calendar'
import { transaction } from '../database/connection'
import * as events from '../database/repositories/calendarEvents'
import * as sources from '../database/repositories/calendarSources'

/**
 * `.ics` import preview / commit and export over the database (spec §10, §10.1, §10.3). No
 * Electron here (dialogs and file reads live in `icsFiles.ts`) so this runs unchanged in Node tests.
 * Nothing is written before `commitImport`: the preview only parses, detects duplicates and parks
 * the result behind a token.
 */

const SAMPLE_SIZE = 8
export const PREVIEW_TTL_MS = 15 * 60 * 1000

interface PendingImport {
  files: ParsedIcsFile[]
  conflicts: DuplicateMatch[]
  targetSourceId?: string
  expiresAt: number
}

const pending = new Map<string, PendingImport>()

const prune = (now: number): void => {
  for (const [token, entry] of pending) if (entry.expiresAt <= now) pending.delete(token)
}

const allEvents = (files: readonly ParsedIcsFile[]): ParsedIcsEvent[] =>
  files.flatMap((f) => f.events)

const isCategory = (value: string | undefined): value is CalendarEventCategory =>
  value !== undefined && (CALENDAR_EVENT_CATEGORIES as readonly string[]).includes(value)

const toPreviewEvent = (event: ParsedIcsEvent): IcsImportPreviewEvent => ({
  key: event.key,
  fileName: event.fileName,
  title: event.title,
  startAt: event.startAt,
  endAt: event.endAt,
  allDay: event.allDay,
  timezone: event.timezone,
  location: event.location,
  recurring: event.recurrenceRule !== undefined || (event.rdates?.length ?? 0) > 0,
  cancelled: event.cancelled
})

const byStart = (a: ParsedIcsEvent, b: ParsedIcsEvent): number =>
  a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : a.title.localeCompare(b.title)

/** Parses the files, detects duplicates against everything stored, and parks the result. */
export const buildImportPreview = (
  db: DatabaseSync,
  request: PreviewIcsImportRequest,
  appZone: string,
  now = Date.now()
): IcsImportPreview => {
  prune(now)
  const parsed = parseIcsFiles(request.files, { appZone })
  const incoming = allEvents(parsed.files)
  const existing = events.listEvents(db, { includeHiddenSources: true })
  const conflicts = detectDuplicates(incoming, existing, request.targetSourceId)
  const byKey = new Map(incoming.map((event) => [event.key, event]))
  const previewToken = randomUUID()
  pending.set(previewToken, {
    files: parsed.files,
    conflicts,
    targetSourceId: request.targetSourceId,
    expiresAt: now + PREVIEW_TTL_MS
  })
  const warnings: string[] = []
  if (incoming.length === 0 && parsed.invalidFiles.length === 0) {
    warnings.push('No events were recognised in the selected files')
  }
  return {
    previewToken,
    files: parsed.files.map((file) => ({
      name: file.name,
      sizeBytes: file.sizeBytes,
      eventCount: file.events.length,
      warnings: [
        ...file.warnings,
        ...file.invalidEvents.map(
          (invalid) =>
            `Skipped ${invalid.summary ? `"${invalid.summary}"` : 'an event'}: ${invalid.reason}`
        )
      ]
    })),
    recognizedEvents: incoming.length,
    dateRange: parsedDateRange(incoming),
    sampleEvents: [...incoming].sort(byStart).slice(0, SAMPLE_SIZE).map(toPreviewEvent),
    conflicts: conflicts.map((conflict) => ({
      key: conflict.key,
      incoming: toPreviewEvent(byKey.get(conflict.key) as ParsedIcsEvent),
      existingEventId: conflict.existingEventId,
      existingTitle: conflict.existingTitle,
      reason: conflict.reason
    })),
    warnings,
    invalidFiles: parsed.invalidFiles,
    targetSourceId: request.targetSourceId
  }
}

/** Removes and returns a parked preview; undefined when unknown or expired. */
export const takeImportPreview = (token: string, now = Date.now()): PendingImport | undefined => {
  prune(now)
  const entry = pending.get(token)
  pending.delete(token)
  return entry
}

const eventInput = (
  event: ParsedIcsEvent,
  sourceId: string,
  masterId: string | undefined
): Parameters<typeof events.createEvent>[1] => ({
  title: event.title,
  description: event.description,
  startAt: event.startAt,
  endAt: event.endAt,
  timezone: event.timezone,
  allDay: event.allDay,
  category: isCategory(event.categoryHint) ? event.categoryHint : 'other',
  recurrenceRule: event.recurrenceRule,
  recurrenceId: event.recurrenceId,
  location: event.location,
  sourceCalendarId: sourceId,
  importedUid: event.uid,
  sourceManaged: false,
  exdates: event.exdates,
  rdates: event.rdates,
  recurrenceMasterId: masterId,
  status: event.cancelled ? 'cancelled' : 'confirmed',
  url: event.url
})

/**
 * Writes the parked preview into one calendar source under the chosen conflict policy
 * (spec §10.1: skip duplicates, replace existing, keep both). Recurrence masters go first so
 * modified instances can point at them; a cancelled instance becomes an EXDATE on its master.
 * Everything runs in one transaction.
 */
export const commitImport = (
  db: DatabaseSync,
  request: CommitIcsImportRequest
): IcsImportResult => {
  const parked = takeImportPreview(request.previewToken)
  if (!parked) {
    throw new AppError('NOT_FOUND', 'The import preview has expired. Choose the files again.')
  }
  const conflictByKey = new Map(parked.conflicts.map((c) => [c.key, c]))
  const incoming = allEvents(parked.files)
  const masters = incoming.filter((e) => e.recurrenceId === undefined).sort(byStart)
  const instances = incoming.filter((e) => e.recurrenceId !== undefined).sort(byStart)

  return transaction(db, () => {
    const source =
      request.source.mode === 'existing'
        ? sources.getSource(db, request.source.id)
        : sources.createSource(db, {
            name: request.source.name,
            color: request.source.color,
            type: 'imported',
            originalFileName: parked.files.length === 1 ? parked.files[0].name : undefined,
            visible: true
          })

    const result: IcsImportResult = {
      imported: 0,
      skipped: 0,
      replaced: 0,
      sourceId: source.id,
      eventIds: []
    }
    /** UID → stored master id, for instances and cancelled occurrences. */
    const masterIds = new Map<string, string>()

    const apply = (
      event: ParsedIcsEvent,
      masterId: string | undefined
    ): CalendarEvent | undefined => {
      const conflict = conflictByKey.get(event.key)
      if (conflict && request.conflictPolicy === 'skip') {
        result.skipped += 1
        return events.findEvent(db, conflict.existingEventId)
      }
      if (conflict && request.conflictPolicy === 'replace') {
        const existing = events.findEvent(db, conflict.existingEventId)
        if (existing) {
          const updated = events.updateEvent(db, existing.id, {
            ...eventInput(event, source.id, masterId),
            sourceCalendarId: existing.sourceCalendarId ?? source.id
          })
          result.replaced += 1
          result.eventIds.push(updated.id)
          return updated
        }
      }
      const created = events.createEvent(db, eventInput(event, source.id, masterId))
      result.imported += 1
      result.eventIds.push(created.id)
      return created
    }

    for (const master of masters) {
      const stored = apply(master, undefined)
      if (stored && master.uid) masterIds.set(master.uid, stored.id)
    }
    for (const instance of instances) {
      const masterId = instance.uid ? masterIds.get(instance.uid) : undefined
      if (instance.cancelled && masterId && instance.recurrenceId) {
        // A cancelled occurrence is an exclusion on its series, not an event of its own.
        const master = events.getEvent(db, masterId)
        const exdates = [...new Set([...(master.exdates ?? []), instance.recurrenceId])]
        events.updateEvent(db, masterId, { exdates })
        continue
      }
      apply(instance, masterId)
    }
    return result
  })
}

/** Events for an export scope (spec §10.3), hidden sources included: export is explicit. */
export const collectExportEvents = (db: DatabaseSync, scope: IcsExportScope): CalendarEvent[] => {
  switch (scope.type) {
    case 'all':
      return events.listEvents(db, { includeHiddenSources: true })
    case 'source':
      return events.listEvents(db, { sourceIds: [scope.sourceId], includeHiddenSources: true })
    case 'range':
      return events.listEvents(db, {
        rangeStart: scope.start,
        rangeEnd: scope.end,
        includeHiddenSources: true
      })
    case 'events':
      return scope.ids.map((id) => events.getEvent(db, id))
  }
}

export interface IcsExport {
  text: string
  count: number
  suggestedName: string
}

export const buildExport = (db: DatabaseSync, scope: IcsExportScope, nowIso: string): IcsExport => {
  const list = collectExportEvents(db, scope)
  const name =
    scope.type === 'source' ? sources.getSource(db, scope.sourceId).name : 'My PhD OS calendar'
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return {
    text: serializeIcs(list, { calendarName: name, nowIso }),
    count: list.length,
    suggestedName: `${slug || 'calendar'}-${nowIso.slice(0, 10)}.ics`
  }
}
