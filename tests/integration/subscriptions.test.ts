import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parseConferenceFeed } from '../../src/shared/conferences/parseConferenceFeed'
import { changeBus } from '../../src/main/database/changeBus'
import { closeDatabase, openDatabase } from '../../src/main/database/connection'
import { runMigrations } from '../../src/main/database/migrate'
import * as events from '../../src/main/database/repositories/calendarEvents'
import * as sources from '../../src/main/database/repositories/calendarSources'
import * as changes from '../../src/main/database/repositories/conferenceChanges'
import * as deadlines from '../../src/main/database/repositories/conferenceDeadlines'
import * as snapshots from '../../src/main/database/repositories/conferenceSnapshots'
import * as subscriptions from '../../src/main/database/repositories/conferenceSubscriptions'
import * as follows from '../../src/main/database/repositories/followedConferences'
import { clearAllUserData } from '../../src/main/database/repositories/maintenance'
import { conferenceHandlers } from '../../src/main/ipc/handlers/conferences'
import type { HandlerContext } from '../../src/main/ipc/registry'
import {
  addConferenceToCalendar,
  removeConferenceFromCalendar
} from '../../src/main/subscriptions/calendarSync'
import { fetchFeed, hashContent } from '../../src/main/subscriptions/fetcher'
import {
  isStale,
  refreshSubscription,
  refreshSubscriptions
} from '../../src/main/subscriptions/refresh'
import { SubscriptionScheduler } from '../../src/main/subscriptions/scheduler'

const FIXTURES = join(__dirname, '../fixtures/ccf')
const EN = readFileSync(join(FIXTURES, 'deadlines_en_sample.ics'), 'utf8')
const URL_EN = 'https://ccfddl.com/conference/deadlines_en.ics'
const NOW = '2026-09-05T10:00:00.000Z'
const LATER = '2026-09-05T16:00:00.000Z'

let dir: string
let db: DatabaseSync
let ctx: HandlerContext

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'my-phd-os-subs-'))
  db = openDatabase(join(dir, 'test.sqlite'))
  runMigrations(db)
  ctx = { db, now: () => NOW } as unknown as HandlerContext
})

afterAll(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  clearAllUserData(db)
  changeBus.flush()
})

interface FakeFeed {
  body: string
  etag: string
  status?: number
}

/** A stand-in for `fetch`: honours If-None-Match with 304 and records every request. */
const fakeFetch = (
  feed: FakeFeed
): typeof fetch & { calls: Array<{ url: string; headers: Record<string, string> }> } => {
  const calls: Array<{ url: string; headers: Record<string, string> }> = []
  const impl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers = Object.fromEntries(
      Object.entries((init?.headers as Record<string, string>) ?? {})
    )
    calls.push({ url: String(input), headers })
    if (headers['If-None-Match'] === feed.etag) return new Response(null, { status: 304 })
    return new Response(feed.body, {
      status: feed.status ?? 200,
      headers: {
        etag: feed.etag,
        'last-modified': 'Fri, 04 Sep 2026 15:33:57 GMT',
        'content-type': 'text/calendar'
      }
    })
  }) as typeof fetch & { calls: typeof calls }
  impl.calls = calls
  return impl
}

const subscribe = (): ReturnType<(typeof conferenceHandlers)['conferences:addSubscription']> =>
  conferenceHandlers['conferences:addSubscription'](
    { url: URL_EN, kind: 'official', language: 'en' },
    ctx
  )

const deps = (fetchImpl: typeof fetch, now = NOW): Parameters<typeof refreshSubscription>[0] => ({
  db,
  now: () => now,
  timeoutMs: 5000,
  fetchImpl
})

describe('fetcher (the only network module)', () => {
  it('refuses non-https and unconfirmed custom hosts before any request is made', async () => {
    const impl = fakeFetch({ body: EN, etag: '"e1"' })
    await expect(
      fetchFeed('http://ccfddl.com/conference/deadlines_en.ics', {
        timeoutMs: 1000,
        fetchImpl: impl
      })
    ).rejects.toMatchObject({ code: 'INVALID_URL' })
    await expect(
      fetchFeed('https://example.org/feed.ics', { timeoutMs: 1000, fetchImpl: impl })
    ).rejects.toMatchObject({ code: 'UNTRUSTED_HOST' })
    expect(impl.calls).toHaveLength(0)
    await expect(
      fetchFeed('https://example.org/feed.ics', {
        timeoutMs: 1000,
        fetchImpl: impl,
        allowCustomHost: true
      })
    ).resolves.toMatchObject({ status: 'ok' })
  })

  it('sends only Accept and the conditional validators, hashes the body, and maps HTTP errors', async () => {
    const impl = fakeFetch({ body: EN, etag: '"e1"' })
    const result = await fetchFeed(URL_EN, {
      timeoutMs: 1000,
      fetchImpl: impl,
      etag: '"old"',
      lastModified: 'x'
    })
    expect(result).toMatchObject({ status: 'ok', etag: '"e1"', contentHash: hashContent(EN) })
    expect(Object.keys(impl.calls[0].headers).sort()).toEqual([
      'Accept',
      'If-Modified-Since',
      'If-None-Match'
    ])
    await expect(
      fetchFeed(URL_EN, { timeoutMs: 1000, fetchImpl: impl, etag: '"e1"' })
    ).resolves.toEqual({ status: 'notModified' })
    await expect(
      fetchFeed(URL_EN, {
        timeoutMs: 1000,
        fetchImpl: fakeFetch({ body: 'x', etag: '"e2"', status: 500 })
      })
    ).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(
      fetchFeed(URL_EN, { timeoutMs: 1000, fetchImpl: fakeFetch({ body: '<html>', etag: '"e3"' }) })
    ).rejects.toMatchObject({ code: 'INVALID_ICS' })
  })

  it('times out and reports TIMEOUT', async () => {
    const never: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    await expect(fetchFeed(URL_EN, { timeoutMs: 20, fetchImpl: never })).rejects.toMatchObject({
      code: 'TIMEOUT'
    })
  })
})

describe('refresh (spec §12.2, §12.3, §12.8)', () => {
  it('stores every round on the first refresh, keeps the raw snapshot, and records no change noise', async () => {
    const subscription = subscribe()
    const impl = fakeFetch({ body: EN, etag: '"e1"' })
    const [outcome] = await refreshSubscriptions(deps(impl))
    const expected = parseConferenceFeed(EN).deadlines.length
    expect(outcome).toMatchObject({ status: 'updated', added: expected, removed: 0, changes: 0 })
    expect(deadlines.listDeadlinesBySubscription(db, subscription.id)).toHaveLength(expected)
    expect(snapshots.findSnapshot(db, subscription.id)).toMatchObject({
      contentHash: hashContent(EN),
      etag: '"e1"',
      rawText: EN
    })
    expect(subscriptions.getSubscription(db, subscription.id)).toMatchObject({
      lastSuccessAt: NOW,
      lastAttemptAt: NOW,
      etag: '"e1"',
      contentHash: hashContent(EN),
      lastError: undefined
    })
    expect(changes.listConferenceChanges(db)).toEqual([])
    const statuses = new Set(
      deadlines.listDeadlinesBySubscription(db, subscription.id).map((d) => d.status)
    )
    expect(statuses.has('tbd')).toBe(false)
  })

  it('treats 304 and identical content as unchanged and still stamps the attempt', async () => {
    const subscription = subscribe()
    const impl = fakeFetch({ body: EN, etag: '"e1"' })
    await refreshSubscriptions(deps(impl))
    const [second] = await refreshSubscriptions(deps(impl, LATER))
    expect(second.status).toBe('unchanged')
    expect(impl.calls[1].headers['If-None-Match']).toBe('"e1"')
    expect(subscriptions.getSubscription(db, subscription.id)).toMatchObject({
      lastAttemptAt: LATER,
      lastSuccessAt: LATER
    })
    // Force ignores validators and re-downloads; identical content is still "unchanged".
    const [forced] = await refreshSubscriptions(deps(impl, LATER), { force: true })
    expect(forced.status).toBe('unchanged')
    expect(impl.calls[2].headers['If-None-Match']).toBeUndefined()
  })

  it('detects a moved deadline, a withdrawn round (TBD) and a new round, keeps records, and re-syncs the calendar event', async () => {
    const subscription = subscribe()
    await refreshSubscriptions(deps(fakeFetch({ body: EN, etag: '"e1"' })))
    const before = deadlines.listDeadlinesBySubscription(db, subscription.id)
    const moved = before.find((d) => d.title === 'AAAI 2027 Deadline')!
    const withdrawn = before.find((d) => d.title === 'AAAI 2027 Abstract Deadline')!

    // Follow + add both to the calendar so the sync is observable.
    const movedEvent = addConferenceToCalendar(db, moved.id)
    const withdrawnEvent = addConferenceToCalendar(db, withdrawn.id)
    expect(movedEvent).toMatchObject({
      sourceManaged: true,
      linkedConferenceDeadlineId: moved.id,
      startAt: moved.deadlineAt
    })

    const modified = EN
      // AAAI 2027 Deadline: 2026-07-28 → 2026-08-04 (UTC−12 23:59:59)
      .replace(
        'DTSTART;TZID="UTC-12:00":20260728T235959',
        'DTSTART;TZID="UTC-12:00":20260804T235959'
      )
      .replace('DTEND;TZID="UTC-12:00":20260729T000059', 'DTEND;TZID="UTC-12:00":20260805T000059')
      // Withdraw the AAAI 2027 abstract round entirely.
      .replace(/BEGIN:VEVENT\r?\nSUMMARY:AAAI 2027 Abstract Deadline[\s\S]*?END:VEVENT\r?\n/, '')
      // Add a brand-new round.
      .replace(
        'END:VCALENDAR',
        'BEGIN:VEVENT\nSUMMARY:NEWCONF 2027 Deadline\nDTSTART;TZID="UTC-12:00":20270101T235959\nDTEND;TZID="UTC-12:00":20270102T000059\nUID:new-uid\nDESCRIPTION:New Conference\\n🗓️ Date: TBD\\n📍 Location: TBD\\n⏰ Original Deadline (AoE): 2027-01-01 23:59:59\\nCategory: 人工智能 (AI)\\nCCF C\nURL:https://newconf.org\nEND:VEVENT\nEND:VCALENDAR'
      )
    expect(modified).not.toBe(EN)
    const [outcome] = await refreshSubscriptions(
      deps(fakeFetch({ body: modified, etag: '"e2"' }), LATER)
    )
    expect(outcome).toMatchObject({ status: 'updated', added: 1, removed: 1 })
    expect(outcome.changes).toBeGreaterThanOrEqual(3)

    const after = deadlines.listDeadlinesBySubscription(db, subscription.id)
    expect(after).toHaveLength(before.length + 1 - 0) // withdrawn record is kept (TBD), new one added
    const movedAfter = deadlines.getConferenceDeadline(db, moved.id)
    expect(movedAfter.deadlineAt).toBe('2026-08-05T11:59:59.000Z')
    const withdrawnAfter = deadlines.getConferenceDeadline(db, withdrawn.id)
    expect(withdrawnAfter).toMatchObject({
      status: 'tbd',
      deadlineAt: undefined,
      title: 'AAAI 2027 Abstract Deadline'
    })
    const added = after.find((d) => d.title === 'NEWCONF 2027 Deadline')
    expect(added).toMatchObject({
      category: 'AI',
      ccfRank: 'C',
      originalTimezoneLabel: 'AoE',
      conferenceDatesText: 'TBD'
    })

    const recorded = changes.listConferenceChanges(db)
    expect(recorded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conferenceDeadlineId: moved.id,
          field: 'deadlineAt',
          previousValue: moved.deadlineAt,
          currentValue: '2026-08-05T11:59:59.000Z',
          acknowledged: false,
          followed: true
        }),
        expect.objectContaining({
          conferenceDeadlineId: withdrawn.id,
          field: 'status',
          previousValue: 'passed',
          currentValue: 'tbd'
        }),
        expect.objectContaining({
          conferenceDeadlineId: added?.id,
          field: 'round',
          currentValue: 'NEWCONF 2027 Deadline'
        })
      ])
    )
    // Source-managed event follows the canonical record; the withdrawn round's event is gone.
    expect(events.getEvent(db, movedEvent.id).startAt).toBe('2026-08-05T11:59:59.000Z')
    expect(events.findEvent(db, withdrawnEvent.id)).toBeUndefined()
    expect(follows.getFollow(db, withdrawn.id).calendarEventId).toBeUndefined()
    expect(follows.getFollow(db, withdrawn.id)).toBeDefined() // still followed

    conferenceHandlers['conferences:acknowledgeChanges']({ ids: recorded.map((c) => c.id) }, ctx)
    expect(changes.listConferenceChanges(db, { unacknowledgedOnly: true })).toEqual([])
  })

  it('keeps the cached snapshot and records the error when a refresh fails', async () => {
    const subscription = subscribe()
    await refreshSubscriptions(deps(fakeFetch({ body: EN, etag: '"e1"' })))
    const count = deadlines.listDeadlinesBySubscription(db, subscription.id).length
    const failing: typeof fetch = async () => {
      throw new Error('ENOTFOUND ccfddl.com')
    }
    const [outcome] = await refreshSubscriptions(deps(failing, LATER))
    expect(outcome).toMatchObject({
      status: 'failed',
      error: expect.objectContaining({ code: 'NETWORK', at: LATER })
    })
    const row = subscriptions.getSubscription(db, subscription.id)
    expect(row.lastError?.message).toContain('ENOTFOUND')
    expect(row.lastAttemptAt).toBe(LATER)
    expect(row.lastSuccessAt).toBe(NOW)
    expect(deadlines.listDeadlinesBySubscription(db, subscription.id)).toHaveLength(count)
    expect(snapshots.findSnapshot(db, subscription.id)?.rawText).toBe(EN)
    // A refresh that fetches a calendar with no deadlines is treated as a failure too.
    const [empty] = await refreshSubscriptions(
      deps(
        fakeFetch({ body: 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n', etag: '"e9"' }),
        LATER
      )
    )
    expect(empty).toMatchObject({
      status: 'failed',
      error: expect.objectContaining({ code: 'INVALID_ICS' })
    })
    expect(deadlines.listDeadlinesBySubscription(db, subscription.id)).toHaveLength(count)
  })

  it('skips disabled subscriptions and flags staleness against the interval', async () => {
    const subscription = subscribe()
    subscriptions.updateSubscription(db, subscription.id, { enabled: false })
    const [outcome] = await refreshSubscriptions(deps(fakeFetch({ body: EN, etag: '"e1"' })))
    expect(outcome.status).toBe('skipped')
    expect(isStale({ lastSuccessAt: undefined }, NOW, 6)).toBe(true)
    expect(isStale({ lastSuccessAt: NOW }, LATER, 6)).toBe(true) // exactly 6 h
    expect(isStale({ lastSuccessAt: NOW }, '2026-09-05T12:00:00.000Z', 6)).toBe(false)
  })
})

describe('add to calendar (spec §12.7)', () => {
  it('creates one source-managed event in the CCF Deadlines source, never duplicates, and removes on request', async () => {
    subscribe()
    await refreshSubscriptions(deps(fakeFetch({ body: EN, etag: '"e1"' })))
    const target = deadlines
      .listConferenceDeadlines(db)
      .find((d) => d.title === 'AAAI 2027 Deadline')!
    const first = conferenceHandlers['conferences:addToCalendar']({ id: target.id }, ctx)
    const second = conferenceHandlers['conferences:addToCalendar']({ id: target.id }, ctx)
    expect(second.id).toBe(first.id)
    expect(events.listEvents(db, { includeHiddenSources: true })).toHaveLength(1)
    const source = sources.getSource(db, first.sourceCalendarId!)
    expect(source).toMatchObject({ type: 'conference', name: 'CCF Deadlines' })
    expect(first).toMatchObject({
      title: 'AAAI 2027 Deadline',
      category: 'deadline',
      sourceManaged: true,
      sourceLabel: 'CCF Deadlines',
      linkedConferenceDeadlineId: target.id,
      startAt: target.deadlineAt,
      timezone: 'UTC-12:00',
      url: target.homepageUrl
    })
    expect(deadlines.getConferenceDeadlineView(db, target.id).followed?.calendarEventId).toBe(
      first.id
    )

    conferenceHandlers['conferences:removeFromCalendar']({ id: target.id }, ctx)
    expect(events.findEvent(db, first.id)).toBeUndefined()
    expect(follows.getFollow(db, target.id).calendarEventId).toBeUndefined()
    // Unfollowing also clears the calendar event.
    conferenceHandlers['conferences:addToCalendar']({ id: target.id }, ctx)
    conferenceHandlers['conferences:unfollow']({ id: target.id }, ctx)
    expect(events.listEvents(db, { includeHiddenSources: true })).toHaveLength(0)
    expect(follows.findFollow(db, target.id)).toBeUndefined()
  })

  it('refuses to add a TBD deadline', async () => {
    const subscription = subscribe()
    await refreshSubscriptions(deps(fakeFetch({ body: EN, etag: '"e1"' })))
    const target = deadlines.listDeadlinesBySubscription(db, subscription.id)[0]
    deadlines.setConferenceDeadlineStatus(db, target.id, 'tbd', null)
    expect(() => addConferenceToCalendar(db, target.id)).toThrowError(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    removeConferenceFromCalendar(db, target.id) // no-op without a follow
  })
})

describe('scheduler', () => {
  it('refreshes on demand, reports status from the database, and never runs one id twice at once', async () => {
    subscribe()
    const impl = fakeFetch({ body: EN, etag: '"e1"' })
    const statuses: boolean[] = []
    const scheduler = new SubscriptionScheduler()
    scheduler.configure({
      getDb: () => db,
      now: () => NOW,
      disabled: true,
      fetchImpl: impl,
      onStatus: (s) => statuses.push(s.inProgress)
    })
    const outcomes = await scheduler.refreshNow()
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0].status).toBe('updated')
    expect(statuses[0]).toBe(true) // in progress while running …
    expect(statuses[statuses.length - 1]).toBe(false) // … and idle afterwards
    const status = scheduler.status(db)
    expect(status.inProgress).toBe(false)
    expect(status.lastSuccessAt).toBe(NOW)
    expect(Object.values(status.perSubscription)[0]).toMatchObject({
      inProgress: false,
      lastOutcome: 'updated',
      lastSuccessAt: NOW
    })
    expect(status.nextAutoRefreshAt).toBeUndefined() // disabled: nothing is scheduled

    // Stale detection: nothing is stale right after a success; everything is after the interval.
    expect(await scheduler.refreshStale()).toEqual([])
    scheduler.configure({
      getDb: () => db,
      now: () => '2026-09-06T10:00:00.000Z',
      disabled: true,
      fetchImpl: impl
    })
    const stale = await scheduler.refreshStale()
    expect(stale).toHaveLength(1)
    expect(stale[0].status).toBe('unchanged')
    scheduler.stop()
  })
})
