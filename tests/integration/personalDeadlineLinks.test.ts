import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { changeBus } from '../../src/main/database/changeBus'
import { closeDatabase, openDatabase } from '../../src/main/database/connection'
import { runMigrations } from '../../src/main/database/migrate'
import * as events from '../../src/main/database/repositories/calendarEvents'
import { clearAllUserData } from '../../src/main/database/repositories/maintenance'
import * as personal from '../../src/main/database/repositories/personalDeadlines'
import type { PersonalDeadline } from '../../src/shared/types/personalDeadline'
import { countRows } from '../../src/main/database/repositories/shared'
import { personalDeadlineHandlers } from '../../src/main/ipc/handlers/personalDeadlines'
import type { HandlerContext } from '../../src/main/ipc/registry'

let dir: string
let db: DatabaseSync
let ctx: HandlerContext

const handlers = personalDeadlineHandlers

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'my-phd-os-links-'))
  db = openDatabase(join(dir, 'test.sqlite'))
  runMigrations(db)
  // The link handlers touch only `ctx.db`.
  ctx = { db, now: () => new Date().toISOString() } as unknown as HandlerContext
})

afterAll(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  clearAllUserData(db)
  changeBus.flush()
})

const createDeadline = (): PersonalDeadline =>
  personal.createPersonalDeadline(db, {
    title: 'Submit paper',
    description: 'Camera-ready',
    trackingStartAt: '2026-09-01T00:00:00Z',
    // 23:59 on Sep 17 in Los Angeles (PDT) = 06:59Z on Sep 18.
    deadlineAt: '2026-09-18T06:59:00Z',
    timezone: 'America/Los_Angeles',
    category: 'paper',
    priority: 'high',
    status: 'in_progress',
    progress: 40,
    sourceUrl: 'https://example.org/cfp'
  })

describe('personal deadline ↔ calendar linking (spec §13.5)', () => {
  it('links as an all-day event on the deadline’s local day and never creates a duplicate', () => {
    const deadline = createDeadline()
    const linked = handlers['personalDeadlines:linkCalendarEvent'](
      { id: deadline.id, mode: 'allDay' },
      ctx
    )
    expect(linked.event).toMatchObject({
      title: 'Submit paper',
      allDay: true,
      startAt: '2026-09-17',
      endAt: '2026-09-18',
      timezone: 'America/Los_Angeles',
      category: 'deadline',
      linkedPersonalDeadlineId: deadline.id,
      url: 'https://example.org/cfp',
      sourceManaged: false
    })
    expect(linked.deadline.linkedCalendarEventId).toBe(linked.event.id)
    expect(countRows(db, 'calendar_events')).toBe(1)

    // Linking again with the other mode updates the same event in place.
    const again = handlers['personalDeadlines:linkCalendarEvent'](
      { id: deadline.id, mode: 'exact' },
      ctx
    )
    expect(again.event.id).toBe(linked.event.id)
    expect(again.event).toMatchObject({
      allDay: false,
      startAt: '2026-09-18T06:59:00.000Z',
      endAt: '2026-09-18T06:59:00.000Z'
    })
    expect(countRows(db, 'calendar_events')).toBe(1)
  })

  it('keeps the linked event in step when the deadline changes', () => {
    const deadline = createDeadline()
    const { event } = handlers['personalDeadlines:linkCalendarEvent'](
      { id: deadline.id, mode: 'exact' },
      ctx
    )
    handlers['personalDeadlines:update'](
      {
        id: deadline.id,
        patch: { title: 'Submit camera-ready', deadlineAt: '2026-09-20T06:59:00Z' }
      },
      ctx
    )
    expect(events.getEvent(db, event.id)).toMatchObject({
      title: 'Submit camera-ready',
      startAt: '2026-09-20T06:59:00.000Z',
      endAt: '2026-09-20T06:59:00.000Z'
    })
    expect(countRows(db, 'calendar_events')).toBe(1)
  })

  it('unlinks keeping the event (back-link cleared) or deleting it', () => {
    const kept = createDeadline()
    const keptLink = handlers['personalDeadlines:linkCalendarEvent'](
      { id: kept.id, mode: 'allDay' },
      ctx
    )
    const unlinked = handlers['personalDeadlines:unlinkCalendarEvent'](
      { id: kept.id, deleteEvent: false },
      ctx
    )
    expect(unlinked.linkedCalendarEventId).toBeUndefined()
    expect(events.getEvent(db, keptLink.event.id).linkedPersonalDeadlineId).toBeUndefined()

    const removed = createDeadline()
    const removedLink = handlers['personalDeadlines:linkCalendarEvent'](
      { id: removed.id, mode: 'allDay' },
      ctx
    )
    handlers['personalDeadlines:unlinkCalendarEvent']({ id: removed.id, deleteEvent: true }, ctx)
    expect(events.findEvent(db, removedLink.event.id)).toBeUndefined()
    expect(personal.getPersonalDeadline(db, removed.id).linkedCalendarEventId).toBeUndefined()
  })

  it('deleting a deadline removes its linked event', () => {
    const deadline = createDeadline()
    const { event } = handlers['personalDeadlines:linkCalendarEvent'](
      { id: deadline.id, mode: 'allDay' },
      ctx
    )
    handlers['personalDeadlines:delete']({ id: deadline.id }, ctx)
    expect(events.findEvent(db, event.id)).toBeUndefined()
    expect(personal.findPersonalDeadline(db, deadline.id)).toBeUndefined()
  })

  it('clears optional fields when the patch carries null', () => {
    const deadline = createDeadline()
    const cleared = handlers['personalDeadlines:update'](
      { id: deadline.id, patch: { description: null, sourceUrl: null } },
      ctx
    )
    expect(cleared.description).toBeUndefined()
    expect(cleared.sourceUrl).toBeUndefined()
  })
})
