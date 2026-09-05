import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ENTITY_NAMES } from '../../src/shared/ipc/events'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE } from '../../src/shared/types/settings'
import { changeBus } from '../../src/main/database/changeBus'
import { closeDatabase, openDatabase } from '../../src/main/database/connection'
import { appliedVersions, runMigrations } from '../../src/main/database/migrate'
import { migrations } from '../../src/main/database/migrations'
import * as events from '../../src/main/database/repositories/calendarEvents'
import * as sources from '../../src/main/database/repositories/calendarSources'
import * as changes from '../../src/main/database/repositories/conferenceChanges'
import * as confDeadlines from '../../src/main/database/repositories/conferenceDeadlines'
import * as snapshots from '../../src/main/database/repositories/conferenceSnapshots'
import * as subscriptions from '../../src/main/database/repositories/conferenceSubscriptions'
import * as warnings from '../../src/main/database/repositories/dismissedWarnings'
import * as follows from '../../src/main/database/repositories/followedConferences'
import * as completions from '../../src/main/database/repositories/habitCompletions'
import * as habits from '../../src/main/database/repositories/habits'
import {
  clearAllUserData,
  dataCounts,
  USER_TABLES
} from '../../src/main/database/repositories/maintenance'
import * as milestones from '../../src/main/database/repositories/milestones'
import * as personal from '../../src/main/database/repositories/personalDeadlines'
import * as settings from '../../src/main/database/repositories/settings'
import { countRows } from '../../src/main/database/repositories/shared'

let dir: string
let db: DatabaseSync

const tableNames = (): string[] =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => String(row.name))

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'my-phd-os-db-'))
  db = openDatabase(join(dir, 'test.sqlite'))
  runMigrations(db)
})

afterAll(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  clearAllUserData(db)
  changeBus.flush()
})

describe('migrations', () => {
  it('records every migration once and is idempotent', () => {
    expect(appliedVersions(db)).toEqual(migrations.map((m) => m.version))
    const again = runMigrations(db)
    expect(again.applied).toEqual([])
    expect(again.currentVersion).toBe(Math.max(...migrations.map((m) => m.version)))
    expect(appliedVersions(db)).toEqual(migrations.map((m) => m.version))
  })

  it('creates every table named in the spec', () => {
    const tables = tableNames()
    for (const table of [
      'schema_migrations',
      'app_meta',
      'settings',
      'calendar_sources',
      'calendar_events',
      'personal_deadlines',
      'conference_subscriptions',
      'conference_snapshots',
      'conference_deadlines',
      'followed_conferences',
      'conference_deadline_changes',
      'milestones',
      'habits',
      'habit_completions',
      'dismissed_warnings'
    ]) {
      expect(tables, `missing table ${table}`).toContain(table)
    }
    expect(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1)
    expect(db.prepare('PRAGMA journal_mode').get()?.journal_mode).toBe('wal')
  })
})

describe('calendar events and sources', () => {
  it('round-trips create, update, delete and emits changes', () => {
    const seen: string[][] = []
    const unsubscribe = changeBus.subscribe(({ entities }) => seen.push(entities))

    const source = sources.createSource(db, {
      name: 'Imported',
      color: '#3b82f6',
      type: 'imported',
      visible: true
    })
    const event = events.createEvent(db, {
      title: 'Seminar',
      startAt: '2026-09-10T09:00:00+02:00',
      endAt: '2026-09-10T10:00:00+02:00',
      timezone: 'Europe/Berlin',
      allDay: false,
      category: 'research',
      sourceManaged: false,
      sourceCalendarId: source.id,
      exdates: ['2026-09-17T07:00:00.000Z']
    })
    expect(event.startAt).toBe('2026-09-10T07:00:00.000Z')
    expect(event.exdates).toEqual(['2026-09-17T07:00:00.000Z'])
    expect(event.sourceCalendarId).toBe(source.id)

    const updated = events.updateEvent(db, event.id, { title: 'Group seminar', location: 'Room 1' })
    expect(updated.title).toBe('Group seminar')
    expect(updated.location).toBe('Room 1')
    expect(updated.updatedAt >= event.updatedAt).toBe(true)

    expect(
      events.listEvents(db, {
        rangeStart: '2026-09-01T00:00:00Z',
        rangeEnd: '2026-10-01T00:00:00Z'
      })
    ).toHaveLength(1)
    expect(
      events.listEvents(db, {
        rangeStart: '2026-10-01T00:00:00Z',
        rangeEnd: '2026-11-01T00:00:00Z'
      })
    ).toHaveLength(0)

    sources.updateSource(db, source.id, { visible: false })
    expect(events.listEvents(db)).toHaveLength(0)
    expect(events.listEvents(db, { includeHiddenSources: true })).toHaveLength(1)

    events.deleteEvent(db, event.id)
    expect(events.findEvent(db, event.id)).toBeUndefined()
    expect(() => events.getEvent(db, event.id)).toThrowError(/not found/)

    changeBus.flush()
    unsubscribe()
    expect(seen.flat()).toEqual(expect.arrayContaining(['calendarEvents', 'calendarSources']))
  })

  it('deletes a source with or without its events', () => {
    const keep = sources.createSource(db, {
      name: 'A',
      color: '#fff',
      type: 'local',
      visible: true
    })
    const drop = sources.createSource(db, {
      name: 'B',
      color: '#000',
      type: 'local',
      visible: true
    })
    const base = {
      startAt: '2026-01-01',
      endAt: '2026-01-02',
      timezone: 'UTC',
      allDay: true,
      category: 'other' as const,
      sourceManaged: false
    }
    events.createEvent(db, { ...base, title: 'kept', sourceCalendarId: keep.id })
    events.createEvent(db, { ...base, title: 'dropped', sourceCalendarId: drop.id })

    expect(sources.deleteSource(db, keep.id, false)).toEqual({ ok: true, deletedEvents: 0 })
    const detached = events.listEvents(db, { includeHiddenSources: true })
    expect(detached.find((e) => e.title === 'kept')?.sourceCalendarId).toBeUndefined()

    expect(sources.deleteSource(db, drop.id, true)).toEqual({ ok: true, deletedEvents: 1 })
    expect(events.listEvents(db).map((e) => e.title)).toEqual(['kept'])
    expect(sources.listSources(db)).toHaveLength(0)
  })
})

describe('calendar event range and consistency rules', () => {
  const timed = {
    timezone: 'Europe/Berlin',
    allDay: false,
    category: 'research' as const,
    sourceManaged: false
  }

  it('normalises offset-bearing range bounds before comparing with stored UTC instants', () => {
    // 01:00+02:00 on the 11th: outside [10th 00:00+02:00, 11th 00:00+02:00)
    events.createEvent(db, {
      ...timed,
      title: 'late',
      startAt: '2026-09-10T23:00:00.000Z',
      endAt: '2026-09-10T23:30:00.000Z'
    })
    // 00:30+02:00 on the 10th: inside the window
    events.createEvent(db, {
      ...timed,
      title: 'early',
      startAt: '2026-09-09T22:30:00.000Z',
      endAt: '2026-09-09T23:00:00.000Z'
    })
    const inWindow = events.listEvents(db, {
      rangeStart: '2026-09-10T00:00:00+02:00',
      rangeEnd: '2026-09-11T00:00:00+02:00'
    })
    expect(inWindow.map((e) => e.title)).toEqual(['early'])
    expect(events.listEvents(db, undefined)).toHaveLength(2)
    expect(events.listEvents(db)).toHaveLength(2)
  })

  it('compares all-day rows by calendar date so the exclusive range end is honoured', () => {
    const allDay = {
      timezone: 'UTC',
      allDay: true,
      category: 'other' as const,
      sourceManaged: false
    }
    events.createEvent(db, {
      ...allDay,
      title: 'on-end',
      startAt: '2026-09-11',
      endAt: '2026-09-12'
    })
    events.createEvent(db, {
      ...allDay,
      title: 'inside',
      startAt: '2026-09-10',
      endAt: '2026-09-11'
    })

    const titles = (filter: Parameters<typeof events.listEvents>[1]): string[] =>
      events.listEvents(db, filter).map((e) => e.title)
    expect(
      titles({ rangeStart: '2026-09-10T00:00:00Z', rangeEnd: '2026-09-11T00:00:00Z' })
    ).toEqual(['inside'])
    expect(titles({ rangeStart: '2026-09-10', rangeEnd: '2026-09-11' })).toEqual(['inside'])
    expect(
      titles({ rangeStart: '2026-09-11T00:00:00+02:00', rangeEnd: '2026-09-12T00:00:00+02:00' })
    ).toEqual(['on-end'])
    expect(titles({ rangeStart: '2026-09-10', rangeEnd: '2026-09-12' })).toEqual([
      'inside',
      'on-end'
    ])
  })

  it('re-validates the merged row on partial updates', () => {
    const event = events.createEvent(db, {
      ...timed,
      title: 'Seminar',
      startAt: '2026-09-10T09:00:00Z',
      endAt: '2026-09-10T10:00:00Z'
    })
    expect(() => events.updateEvent(db, event.id, { endAt: '2026-09-10T08:00:00Z' })).toThrowError(
      expect.objectContaining({ code: 'VALIDATION', details: { id: event.id, field: 'endAt' } })
    )
    // Same instant expressed with an offset: 10:00+02:00 is 08:00Z, before the start.
    expect(() => events.updateEvent(db, event.id, { endAt: '2026-09-10T10:00:00+02:00' })).toThrow()
    expect(() => events.updateEvent(db, event.id, { allDay: true })).toThrowError(
      expect.objectContaining({ code: 'VALIDATION', details: { id: event.id, field: 'startAt' } })
    )
    expect(events.getEvent(db, event.id)).toMatchObject({
      allDay: false,
      endAt: '2026-09-10T10:00:00.000Z'
    })
    expect(
      events.updateEvent(db, event.id, { allDay: true, startAt: '2026-09-10', endAt: '2026-09-11' })
    ).toMatchObject({ allDay: true, startAt: '2026-09-10', endAt: '2026-09-11' })
  })

  it('announces the entities nulled by ON DELETE SET NULL when events are deleted', () => {
    const source = sources.createSource(db, {
      name: 'S',
      color: '#fff',
      type: 'local',
      visible: true
    })
    const event = events.createEvent(db, {
      ...timed,
      title: 'Linked',
      startAt: '2026-09-10T09:00:00Z',
      endAt: '2026-09-10T10:00:00Z',
      sourceCalendarId: source.id
    })
    const deadline = personal.createPersonalDeadline(db, {
      title: 'P',
      trackingStartAt: '2026-09-01T00:00:00Z',
      deadlineAt: '2026-09-10T10:00:00Z',
      timezone: 'UTC',
      category: 'other',
      priority: 'low',
      status: 'not_started',
      progress: 0
    })
    personal.updatePersonalDeadline(db, deadline.id, { linkedCalendarEventId: event.id })
    expect(personal.getPersonalDeadline(db, deadline.id).linkedCalendarEventId).toBe(event.id)
    changeBus.flush()

    const seen: string[][] = []
    const unsubscribe = changeBus.subscribe(({ entities }) => seen.push(entities))
    events.deleteEvent(db, event.id)
    changeBus.flush()
    expect(seen.at(-1)).toEqual(
      expect.arrayContaining(['calendarEvents', 'personalDeadlines', 'followedConferences'])
    )
    expect(personal.getPersonalDeadline(db, deadline.id).linkedCalendarEventId).toBeUndefined()

    events.createEvent(db, {
      ...timed,
      title: 'Second',
      startAt: '2026-09-11T09:00:00Z',
      endAt: '2026-09-11T10:00:00Z',
      sourceCalendarId: source.id
    })
    changeBus.flush()
    seen.length = 0
    sources.deleteSource(db, source.id, true)
    changeBus.flush()
    unsubscribe()
    expect(seen.at(-1)).toEqual(
      expect.arrayContaining([
        'calendarSources',
        'calendarEvents',
        'personalDeadlines',
        'followedConferences'
      ])
    )
  })
})

describe('personal deadlines and milestones', () => {
  it('round-trips a personal deadline and its progress', () => {
    const milestone = milestones.createMilestone(db, {
      title: 'Thesis proposal',
      startAt: '2026-09-01T00:00:00Z',
      targetAt: '2026-12-01T00:00:00Z',
      category: 'phd_progress',
      status: 'in_progress',
      progress: 10
    })
    const deadline = personal.createPersonalDeadline(db, {
      title: 'Submit proposal draft',
      trackingStartAt: '2026-09-01T00:00:00Z',
      deadlineAt: '2026-10-01T12:00:00Z',
      timezone: 'America/Vancouver',
      category: 'academic',
      priority: 'high',
      status: 'not_started',
      progress: 0,
      tags: ['thesis'],
      linkedMilestoneId: milestone.id
    })
    expect(deadline.tags).toEqual(['thesis'])
    expect(deadline.linkedMilestoneId).toBe(milestone.id)

    expect(personal.setPersonalDeadlineProgress(db, deadline.id, 40).progress).toBe(40)
    expect(() =>
      personal.updatePersonalDeadline(db, deadline.id, { deadlineAt: '2026-08-01T00:00:00Z' })
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION' }))
    expect(() =>
      personal.updatePersonalDeadline(db, deadline.id, {
        trackingStartAt: '2026-10-01T15:00:00+02:00'
      })
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION' }))
    expect(personal.listPersonalDeadlines(db, undefined)).toHaveLength(1)
    const done = personal.updatePersonalDeadline(db, deadline.id, { status: 'completed' })
    expect(done.status).toBe('completed')
    expect(personal.listPersonalDeadlines(db)).toHaveLength(0)
    expect(personal.listPersonalDeadlines(db, { includeCompleted: true })).toHaveLength(1)

    milestones.deleteMilestone(db, milestone.id)
    expect(personal.getPersonalDeadline(db, deadline.id).linkedMilestoneId).toBeUndefined()

    personal.deletePersonalDeadline(db, deadline.id)
    expect(personal.findPersonalDeadline(db, deadline.id)).toBeUndefined()
  })

  it('updates and lists milestones ordered by start', () => {
    milestones.createMilestone(db, {
      title: 'Later',
      startAt: '2027-01-01T00:00:00Z',
      targetAt: '2027-06-01T00:00:00Z',
      category: 'research',
      status: 'not_started',
      progress: 0
    })
    const first = milestones.createMilestone(db, {
      title: 'Earlier',
      startAt: '2026-01-01T00:00:00Z',
      targetAt: '2026-06-01T00:00:00Z',
      category: 'coursework',
      status: 'not_started',
      progress: 0
    })
    expect(milestones.listMilestones(db).map((m) => m.title)).toEqual(['Earlier', 'Later'])
    expect(
      milestones.updateMilestone(db, first.id, { progress: 55, status: 'delayed' })
    ).toMatchObject({ progress: 55, status: 'delayed' })
  })
})

describe('habits and completions', () => {
  it('creates, archives, completes and deletes habits', () => {
    const habit = habits.createHabit(db, {
      name: 'Read a paper',
      color: '#22c55e',
      frequency: { type: 'weekly', targetCount: 3 }
    })
    expect(habit.frequency).toEqual({ type: 'weekly', targetCount: 3 })

    const first = completions.setCompletion(db, habit.id, '2026-09-04', true)
    const again = completions.setCompletion(db, habit.id, '2026-09-04', false)
    expect(again.id).toBe(first.id)
    expect(again.completed).toBe(false)
    expect(countRows(db, 'habit_completions')).toBe(1)
    expect(
      completions.listCompletions(db, { from: '2026-09-01', to: '2026-09-30', habitId: habit.id })
    ).toHaveLength(1)
    expect(completions.listCompletions(db, { from: '2026-10-01', to: '2026-10-31' })).toHaveLength(
      0
    )

    expect(habits.setHabitArchived(db, habit.id, true).archivedAt).toBeDefined()
    expect(habits.listHabits(db)).toHaveLength(0)
    expect(habits.listHabits(db, { includeArchived: true })).toHaveLength(1)
    expect(habits.updateHabit(db, habit.id, { name: 'Read two papers' }).name).toBe(
      'Read two papers'
    )

    habits.deleteHabit(db, habit.id)
    expect(countRows(db, 'habit_completions')).toBe(0)
  })
})

describe('conference subscriptions, deadlines, follows and changes', () => {
  const deadlineInput = (
    subscriptionId: string,
    stableKey: string,
    title: string
  ): confDeadlines.ConferenceDeadlineInput => ({
    subscriptionId,
    stableKey,
    title,
    conferenceName: title.split(' ')[0],
    conferenceYear: 2027,
    category: 'AI',
    ccfRank: 'A',
    deadlineAt: '2026-11-15T11:59:00.000Z',
    originalTimezone: 'UTC-12:00',
    originalTimezoneLabel: 'AoE',
    sourceUrl: 'https://ccfddl.com/conference/deadlines_en.ics',
    status: 'upcoming' as const,
    upstreamSnapshotHash: 'hash-1',
    deadlineKind: 'deadline' as const,
    allDay: false
  })

  it('round-trips the whole conference graph', () => {
    const sub = subscriptions.createSubscription(db, {
      url: 'https://ccfddl.com/conference/deadlines_en_ccf_A.ics',
      label: 'CCF A',
      kind: 'official',
      language: 'en',
      filters: { ccf: 'A' }
    })
    expect(sub.enabled).toBe(true)
    expect(sub.filters).toEqual({ ccf: 'A' })
    expect(() =>
      subscriptions.createSubscription(db, { url: sub.url, label: 'dup', kind: 'official' })
    ).toThrowError(/already exists/)

    subscriptions.recordFetchState(db, sub.id, {
      etag: '"abc"',
      lastAttemptAt: '2026-09-04T10:00:00.000Z',
      lastSuccessAt: '2026-09-04T10:00:00.000Z',
      lastError: null
    })
    expect(subscriptions.getSubscription(db, sub.id).etag).toBe('"abc"')
    expect(subscriptions.updateSubscription(db, sub.id, { enabled: false }).enabled).toBe(false)

    snapshots.saveSnapshot(db, {
      subscriptionId: sub.id,
      contentHash: 'hash-1',
      fetchedAt: '2026-09-04T10:00:00.000Z',
      rawText: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    })
    expect(snapshots.findSnapshot(db, sub.id)?.contentHash).toBe('hash-1')

    const a = confDeadlines.upsertConferenceDeadline(
      db,
      deadlineInput(sub.id, 'aaai-2027:1', 'AAAI 2027')
    )
    const b = confDeadlines.upsertConferenceDeadline(
      db,
      deadlineInput(sub.id, 'cvpr-2027:1', 'CVPR 2027')
    )
    const aAgain = confDeadlines.upsertConferenceDeadline(db, {
      ...deadlineInput(sub.id, 'aaai-2027:1', 'AAAI 2027'),
      deadlineAt: '2026-11-20T11:59:00.000Z',
      upstreamSnapshotHash: 'hash-2'
    })
    expect(aAgain.id).toBe(a.id)
    expect(aAgain.deadlineAt).toBe('2026-11-20T11:59:00.000Z')
    expect(aAgain.firstSeenAt).toBe(a.firstSeenAt)
    expect(countRows(db, 'conference_deadlines')).toBe(2)

    const follow = follows.followConference(db, a.id, 'considering')
    expect(follow.intention).toBe('considering')
    expect(follows.followConference(db, a.id).conferenceDeadlineId).toBe(a.id)
    expect(follows.updateFollow(db, a.id, { progress: 30, notes: 'outline done' })).toMatchObject({
      progress: 30,
      notes: 'outline done'
    })

    const views = confDeadlines.listConferenceDeadlines(db)
    expect(views.map((v) => v.title)).toEqual(['CVPR 2027', 'AAAI 2027'])
    expect(views.find((v) => v.id === a.id)?.followed?.progress).toBe(30)
    expect(views[0].subscriptionLabel).toBe('CCF A')
    expect(confDeadlines.listConferenceDeadlines(db, { followedOnly: true })).toHaveLength(1)
    expect(confDeadlines.listConferenceDeadlines(db, { search: 'cvpr' })).toHaveLength(1)
    expect(confDeadlines.listConferenceDeadlines(db, { years: [2020] })).toHaveLength(0)
    expect(confDeadlines.listFollowedDeadlines(db).map((v) => v.id)).toEqual([a.id])

    confDeadlines.setConferenceDeadlineStatus(db, b.id, 'tbd', null)
    expect(confDeadlines.getConferenceDeadline(db, b.id).deadlineAt).toBeUndefined()
    expect(confDeadlines.listConferenceDeadlines(db, { statuses: ['upcoming'] })).toHaveLength(1)

    const change = changes.recordConferenceChange(db, {
      conferenceDeadlineId: a.id,
      field: 'deadlineAt',
      previousValue: '2026-11-15T11:59:00.000Z',
      currentValue: '2026-11-20T11:59:00.000Z',
      upstreamSnapshotHash: 'hash-2'
    })
    expect(change.previousValue).toBe('2026-11-15T11:59:00.000Z')
    const unread = changes.listConferenceChanges(db, {
      unacknowledgedOnly: true,
      followedOnly: true
    })
    expect(unread).toHaveLength(1)
    expect(unread[0]).toMatchObject({ conferenceTitle: 'AAAI 2027', followed: true })
    expect(changes.acknowledgeConferenceChanges(db, [change.id, 'missing'])).toBe(1)
    expect(changes.listConferenceChanges(db, { unacknowledgedOnly: true })).toHaveLength(0)

    follows.unfollowConference(db, a.id)
    expect(follows.findFollow(db, a.id)).toBeUndefined()
    follows.followConference(db, b.id)

    const removed = subscriptions.removeSubscription(db, sub.id)
    expect(removed).toEqual({ ok: true, removedDeadlines: 2 })
    for (const table of [
      'conference_deadlines',
      'followed_conferences',
      'conference_deadline_changes',
      'conference_snapshots'
    ]) {
      expect(countRows(db, table), table).toBe(0)
    }
  })
})

describe('settings and dismissed warnings', () => {
  it('returns defaults, merges patches and tolerates corrupt stored values', () => {
    expect(settings.getSettingsBundle(db)).toEqual({
      settings: DEFAULT_SETTINGS,
      ui: DEFAULT_UI_STATE
    })

    const patched = settings.patchSettings(db, { theme: 'dark', weekStartsOn: 0 })
    expect(patched).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', weekStartsOn: 0 })
    expect(settings.patchSettings(db, { clock: '12h' })).toMatchObject({
      theme: 'dark',
      clock: '12h'
    })
    expect(() => settings.patchSettings(db, { timezone: 'Mars/Olympus' })).toThrow()

    expect(settings.patchUiState(db, { lastPage: 'habits', sidebarCollapsed: true })).toEqual({
      ...DEFAULT_UI_STATE,
      lastPage: 'habits',
      sidebarCollapsed: true
    })

    settings.writeJsonSetting(db, 'app', { theme: 'neon', clock: '24h', unknown: 1 })
    expect(settings.getSettings(db)).toEqual({ ...DEFAULT_SETTINGS, clock: '24h' })

    expect(settings.getWindowState(db)).toBeUndefined()
    settings.setWindowState(db, { x: 10, y: 20, width: 1200, height: 800, isMaximized: false })
    expect(settings.getWindowState(db)).toEqual({
      x: 10,
      y: 20,
      width: 1200,
      height: 800,
      isMaximized: false
    })
  })

  it('dismisses, restores and clears warnings', () => {
    const warning = warnings.dismissWarning(db, 'timeline:overlap:1', { ids: ['a', 'b'] })
    expect(warning.payload).toEqual({ ids: ['a', 'b'] })
    expect(warnings.dismissWarning(db, 'timeline:overlap:1').payload).toBeUndefined()
    warnings.dismissWarning(db, 'other')
    expect(warnings.listDismissedWarnings(db)).toHaveLength(2)
    warnings.restoreWarning(db, 'other')
    expect(warnings.listDismissedWarnings(db).map((w) => w.key)).toEqual(['timeline:overlap:1'])
    warnings.clearDismissedWarnings(db)
    expect(warnings.listDismissedWarnings(db)).toHaveLength(0)
  })
})

describe('maintenance', () => {
  it('counts every entity and clearAllUserData empties every user table', () => {
    const source = sources.createSource(db, {
      name: 'S',
      color: '#fff',
      type: 'local',
      visible: true
    })
    events.createEvent(db, {
      title: 'E',
      startAt: '2026-01-01',
      endAt: '2026-01-02',
      timezone: 'UTC',
      allDay: true,
      category: 'other',
      sourceManaged: false,
      sourceCalendarId: source.id
    })
    const habit = habits.createHabit(db, { name: 'H', color: '#fff', frequency: { type: 'daily' } })
    completions.setCompletion(db, habit.id, '2026-01-01', true)
    milestones.createMilestone(db, {
      title: 'M',
      startAt: '2026-01-01T00:00:00Z',
      targetAt: '2026-02-01T00:00:00Z',
      category: 'other',
      status: 'not_started',
      progress: 0
    })
    personal.createPersonalDeadline(db, {
      title: 'P',
      trackingStartAt: '2026-01-01T00:00:00Z',
      deadlineAt: '2026-02-01T00:00:00Z',
      timezone: 'UTC',
      category: 'other',
      priority: 'low',
      status: 'not_started',
      progress: 0
    })
    warnings.dismissWarning(db, 'w')
    settings.patchSettings(db, { theme: 'light' })
    settings.setWindowState(db, { width: 1000, height: 700, isMaximized: true })

    const counts = dataCounts(db)
    expect(Object.keys(counts).sort()).toEqual(
      ENTITY_NAMES.filter((name) => name !== 'settings').sort()
    )
    expect(counts).toMatchObject({
      calendarEvents: 1,
      calendarSources: 1,
      habits: 1,
      habitCompletions: 1,
      milestones: 1,
      personalDeadlines: 1,
      dismissedWarnings: 1
    })

    clearAllUserData(db)
    for (const table of USER_TABLES) {
      if (table === 'settings') continue
      expect(countRows(db, table), table).toBe(0)
    }
    expect(Object.values(dataCounts(db)).every((n) => n === 0)).toBe(true)
    expect(settings.getSettings(db)).toEqual(DEFAULT_SETTINGS)
    expect(settings.getWindowState(db)).toEqual({ width: 1000, height: 700, isMaximized: true })
    expect(appliedVersions(db)).toEqual(migrations.map((m) => m.version))
  })
})
