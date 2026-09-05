import type { DatabaseSync } from 'node:sqlite'
import { compareSnapshots } from '@shared/conferences/compareSnapshots'
import {
  parseConferenceFeed,
  statusFor,
  type ParsedConferenceFeed
} from '@shared/conferences/parseConferenceFeed'
import { AppError } from '@shared/errors'
import type {
  ConferenceSubscription,
  RefreshOutcome,
  SubscriptionError
} from '@shared/types/conference'
import { transaction } from '../database/connection'
import * as changes from '../database/repositories/conferenceChanges'
import * as deadlines from '../database/repositories/conferenceDeadlines'
import * as snapshots from '../database/repositories/conferenceSnapshots'
import * as subscriptions from '../database/repositories/conferenceSubscriptions'
import { syncConferenceCalendarEvent } from './calendarSync'
import { fetchFeed } from './fetcher'

export type LogLevel = 'info' | 'warn' | 'error'
export type LogFn = (level: LogLevel, message: string, details?: Record<string, unknown>) => void

export interface RefreshDeps {
  db: DatabaseSync
  now: () => string
  timeoutMs: number
  fetchImpl?: typeof fetch
  log?: LogFn
}

export interface FetchedSnapshot {
  rawText: string
  contentHash: string
  etag?: string
  lastModified?: string
}

export interface ApplyResult {
  changes: number
  added: number
  removed: number
}

const MS_PER_HOUR = 60 * 60 * 1000

/** Never fetched successfully, or last success older than the configured interval. */
export const isStale = (
  subscription: Pick<ConferenceSubscription, 'lastSuccessAt'>,
  nowIso: string,
  intervalHours: number
): boolean =>
  !subscription.lastSuccessAt ||
  Date.parse(nowIso) - Date.parse(subscription.lastSuccessAt) >= intervalHours * MS_PER_HOUR

/**
 * Writes a parsed snapshot into the canonical records (spec §12.3, §12.8) in one transaction:
 * upsert every round by stable key, mark vanished rounds TBD (records are never deleted), record
 * field changes with previous and current values, re-sync followed conferences' calendar events,
 * store the raw snapshot, and stamp the subscription's fetch state.
 */
export const applyFeedSnapshot = (
  db: DatabaseSync,
  subscription: ConferenceSubscription,
  parsed: ParsedConferenceFeed,
  fetched: FetchedSnapshot,
  nowIso: string
): ApplyResult =>
  transaction(db, () => {
    const existing = deadlines.listDeadlinesBySubscription(db, subscription.id)
    const firstSnapshot = snapshots.findSnapshot(db, subscription.id) === undefined
    const comparison = compareSnapshots(existing, parsed.deadlines)
    const changedByKey = new Map(comparison.changed.map((c) => [c.incoming.stableKey, c]))
    const addedKeys = new Set(comparison.added.map((a) => a.stableKey))
    let changeCount = 0

    for (const incoming of parsed.deadlines) {
      const record = deadlines.upsertConferenceDeadline(
        db,
        {
          ...incoming,
          subscriptionId: subscription.id,
          sourceUrl: subscription.url,
          status: statusFor(incoming.deadlineAt, nowIso),
          upstreamSnapshotHash: fetched.contentHash,
          upstreamUpdatedAt: undefined
        },
        nowIso
      )
      const changed = changedByKey.get(incoming.stableKey)
      if (changed) {
        for (const change of changed.changes) {
          changes.recordConferenceChange(db, {
            conferenceDeadlineId: record.id,
            field: change.field,
            previousValue: change.previousValue,
            currentValue: change.currentValue,
            upstreamSnapshotHash: fetched.contentHash,
            detectedAt: nowIso
          })
          changeCount += 1
        }
        syncConferenceCalendarEvent(db, record)
      } else if (addedKeys.has(incoming.stableKey) && !firstSnapshot) {
        changes.recordConferenceChange(db, {
          conferenceDeadlineId: record.id,
          field: 'round',
          previousValue: null,
          currentValue: record.title,
          upstreamSnapshotHash: fetched.contentHash,
          detectedAt: nowIso
        })
        changeCount += 1
      }
    }

    for (const vanished of comparison.removed) {
      const record = deadlines.setConferenceDeadlineStatus(db, vanished.id, 'tbd', null)
      changes.recordConferenceChange(db, {
        conferenceDeadlineId: vanished.id,
        field: 'status',
        previousValue: vanished.status,
        currentValue: 'tbd',
        upstreamSnapshotHash: fetched.contentHash,
        detectedAt: nowIso
      })
      changeCount += 1
      syncConferenceCalendarEvent(db, record)
    }

    snapshots.saveSnapshot(db, {
      subscriptionId: subscription.id,
      contentHash: fetched.contentHash,
      fetchedAt: nowIso,
      etag: fetched.etag,
      lastModified: fetched.lastModified,
      rawText: fetched.rawText
    })
    subscriptions.recordFetchState(db, subscription.id, {
      etag: fetched.etag ?? null,
      lastModified: fetched.lastModified ?? null,
      contentHash: fetched.contentHash,
      lastSuccessAt: nowIso,
      lastAttemptAt: nowIso,
      lastError: null
    })
    return {
      changes: changeCount,
      added: comparison.added.length,
      removed: comparison.removed.length
    }
  })

const toSubscriptionError = (error: unknown, at: string): SubscriptionError =>
  error instanceof AppError
    ? { message: error.message, code: error.code, at }
    : { message: error instanceof Error ? error.message : String(error), at }

/**
 * One subscription: conditional fetch, snapshot apply, outcome. A failure records the error on the
 * subscription and keeps every cached record and the previous snapshot (spec §12.2).
 */
export const refreshSubscription = async (
  deps: RefreshDeps,
  subscription: ConferenceSubscription,
  options: { force?: boolean } = {}
): Promise<RefreshOutcome> => {
  const fetchedAt = deps.now()
  const base = { subscriptionId: subscription.id, fetchedAt, changes: 0, added: 0, removed: 0 }
  if (!subscription.enabled) return { ...base, status: 'skipped' }
  const previousSnapshot = snapshots.findSnapshot(deps.db, subscription.id)
  try {
    const result = await fetchFeed(subscription.url, {
      etag: options.force || !previousSnapshot ? undefined : subscription.etag,
      lastModified: options.force || !previousSnapshot ? undefined : subscription.lastModified,
      timeoutMs: deps.timeoutMs,
      allowCustomHost:
        subscription.kind === 'custom' && subscription.customConfirmedAt !== undefined,
      fetchImpl: deps.fetchImpl
    })
    if (
      result.status === 'notModified' ||
      (previousSnapshot && result.contentHash === previousSnapshot.contentHash)
    ) {
      subscriptions.recordFetchState(deps.db, subscription.id, {
        lastSuccessAt: fetchedAt,
        lastAttemptAt: fetchedAt,
        lastError: null,
        ...(result.status === 'ok'
          ? { etag: result.etag ?? null, lastModified: result.lastModified ?? null }
          : {})
      })
      deadlines.reconcileStatuses(deps.db, fetchedAt)
      return { ...base, status: 'unchanged' }
    }
    const parsed = parseConferenceFeed(result.text)
    if (parsed.warnings.length > 0) {
      deps.log?.('warn', 'feed events skipped', {
        id: subscription.id,
        count: parsed.warnings.length
      })
    }
    if (parsed.deadlines.length === 0) {
      throw new AppError(
        'INVALID_ICS',
        'The feed contained no conference deadlines; the cached snapshot was kept',
        {
          id: subscription.id
        }
      )
    }
    const applied = applyFeedSnapshot(
      deps.db,
      subscription,
      parsed,
      {
        rawText: result.text,
        contentHash: result.contentHash,
        etag: result.etag,
        lastModified: result.lastModified
      },
      fetchedAt
    )
    deps.log?.('info', 'subscription refreshed', {
      id: subscription.id,
      count: parsed.deadlines.length,
      ...applied
    })
    return { ...base, status: 'updated', ...applied }
  } catch (error) {
    const failure = toSubscriptionError(error, fetchedAt)
    subscriptions.recordFetchState(deps.db, subscription.id, {
      lastAttemptAt: fetchedAt,
      lastError: failure
    })
    deps.log?.('warn', 'subscription refresh failed', {
      id: subscription.id,
      code: failure.code,
      reason: failure.message
    })
    return { ...base, status: 'failed', error: failure }
  }
}

/** Refreshes one subscription, or every enabled one (sequentially, so failures stay isolated). */
export const refreshSubscriptions = async (
  deps: RefreshDeps,
  request: { subscriptionId?: string; force?: boolean } = {}
): Promise<RefreshOutcome[]> => {
  const all = subscriptions.listSubscriptions(deps.db)
  const targets = request.subscriptionId ? all.filter((s) => s.id === request.subscriptionId) : all
  if (request.subscriptionId && targets.length === 0) {
    throw new AppError('NOT_FOUND', 'Conference subscription not found', {
      id: request.subscriptionId
    })
  }
  const outcomes: RefreshOutcome[] = []
  for (const subscription of targets) {
    outcomes.push(await refreshSubscription(deps, subscription, { force: request.force }))
  }
  return outcomes
}
