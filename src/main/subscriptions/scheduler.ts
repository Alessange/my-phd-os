import type { DatabaseSync } from 'node:sqlite'
import type {
  RefreshOutcome,
  RefreshStatus,
  SubscriptionRefreshState
} from '@shared/types/conference'
import * as deadlines from '../database/repositories/conferenceDeadlines'
import * as subscriptions from '../database/repositories/conferenceSubscriptions'
import { getSettings } from '../database/repositories/settings'
import { isStale, refreshSubscriptions, type LogFn } from './refresh'

export interface SchedulerConfig {
  /** The live database, or null while it is unavailable. */
  getDb: () => DatabaseSync | null
  now?: () => string
  /** E2E / tests: no startup or periodic refresh (manual refresh still works). */
  disabled?: boolean
  onStatus?: (status: RefreshStatus) => void
  log?: LogFn
  fetchImpl?: typeof fetch
}

const STARTUP_DELAY_MS = 3_000
const TICK_MS = 10 * 60 * 1000
const MS_PER_HOUR = 60 * 60 * 1000

/**
 * Background refresh of conference subscriptions (spec §12.2): on launch when the cache is stale
 * (if `refreshOnLaunch`), then periodically against the configured interval; plus "Refresh now".
 * Status is derived from what the database recorded, plus what is running right now.
 */
export class SubscriptionScheduler {
  private config: SchedulerConfig = { getDb: () => null }
  private startupTimer: ReturnType<typeof setTimeout> | undefined
  private tickTimer: ReturnType<typeof setInterval> | undefined
  private readonly inProgress = new Set<string>()
  private lastOutcomes = new Map<string, RefreshOutcome>()

  configure(config: SchedulerConfig): void {
    this.config = config
  }

  private now(): string {
    return (this.config.now ?? (() => new Date().toISOString()))()
  }

  start(): void {
    this.stop()
    if (this.config.disabled) return
    this.startupTimer = setTimeout(() => {
      const db = this.config.getDb()
      if (db && getSettings(db).refreshOnLaunch) void this.refreshStale()
    }, STARTUP_DELAY_MS)
    this.tickTimer = setInterval(() => void this.refreshStale(), TICK_MS)
  }

  stop(): void {
    if (this.startupTimer) clearTimeout(this.startupTimer)
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.startupTimer = undefined
    this.tickTimer = undefined
  }

  /** Every enabled subscription whose cache is older than the interval. */
  async refreshStale(): Promise<RefreshOutcome[]> {
    const db = this.config.getDb()
    if (!db) return []
    const nowIso = this.now()
    const interval = getSettings(db).subscriptionRefreshIntervalHours
    deadlines.reconcileStatuses(db, nowIso)
    const stale = subscriptions
      .listSubscriptions(db)
      .filter((s) => s.enabled && isStale(s, nowIso, interval) && !this.inProgress.has(s.id))
    const outcomes: RefreshOutcome[] = []
    for (const subscription of stale) {
      outcomes.push(...(await this.refreshNow({ subscriptionId: subscription.id })))
    }
    return outcomes
  }

  /** Manual or scheduled refresh of one or all subscriptions; concurrent requests for one id are skipped. */
  async refreshNow(
    request: { subscriptionId?: string; force?: boolean } = {}
  ): Promise<RefreshOutcome[]> {
    const db = this.config.getDb()
    if (!db) return []
    const targets = subscriptions
      .listSubscriptions(db)
      .filter((s) => (request.subscriptionId ? s.id === request.subscriptionId : true))
    const runnable = targets.filter((s) => !this.inProgress.has(s.id))
    const skipped: RefreshOutcome[] = targets
      .filter((s) => this.inProgress.has(s.id))
      .map((s) => ({
        subscriptionId: s.id,
        status: 'skipped',
        fetchedAt: this.now(),
        changes: 0,
        added: 0,
        removed: 0
      }))
    for (const s of runnable) this.inProgress.add(s.id)
    this.emitStatus(db)
    const outcomes: RefreshOutcome[] = [...skipped]
    try {
      const settings = getSettings(db)
      for (const subscription of runnable) {
        const [outcome] = await refreshSubscriptions(
          {
            db,
            now: () => this.now(),
            timeoutMs: settings.requestTimeoutMs,
            fetchImpl: this.config.fetchImpl,
            log: this.config.log
          },
          { subscriptionId: subscription.id, force: request.force }
        )
        if (outcome) {
          outcomes.push(outcome)
          this.lastOutcomes.set(subscription.id, outcome)
        }
        this.inProgress.delete(subscription.id)
        this.emitStatus(db)
      }
    } finally {
      for (const s of runnable) this.inProgress.delete(s.id)
      this.emitStatus(db)
    }
    return outcomes
  }

  status(db: DatabaseSync): RefreshStatus {
    const rows = subscriptions.listSubscriptions(db)
    const settings = getSettings(db)
    const perSubscription: Record<string, SubscriptionRefreshState> = {}
    let nextAuto: number | undefined
    for (const row of rows) {
      perSubscription[row.id] = {
        subscriptionId: row.id,
        inProgress: this.inProgress.has(row.id),
        lastSuccessAt: row.lastSuccessAt,
        lastAttemptAt: row.lastAttemptAt,
        lastError: row.lastError,
        lastOutcome: this.lastOutcomes.get(row.id)?.status
      }
      if (row.enabled && !this.config.disabled) {
        const due = row.lastSuccessAt
          ? Date.parse(row.lastSuccessAt) + settings.subscriptionRefreshIntervalHours * MS_PER_HOUR
          : Date.parse(this.now())
        nextAuto = nextAuto === undefined ? due : Math.min(nextAuto, due)
      }
    }
    const latestFailure = rows
      .map((row) => row.lastError)
      .filter((e): e is NonNullable<typeof e> => !!e)
      .sort((a, b) => a.at.localeCompare(b.at))
      .pop()
    const max = (values: Array<string | undefined>): string | undefined =>
      values
        .filter((v): v is string => typeof v === 'string')
        .sort()
        .pop()
    return {
      inProgress: this.inProgress.size > 0,
      lastSuccessAt: max(rows.map((r) => r.lastSuccessAt)),
      lastAttemptAt: max(rows.map((r) => r.lastAttemptAt)),
      lastError: latestFailure,
      nextAutoRefreshAt: nextAuto === undefined ? undefined : new Date(nextAuto).toISOString(),
      perSubscription
    }
  }

  private emitStatus(db: DatabaseSync): void {
    this.config.onStatus?.(this.status(db))
  }
}

/** Application-wide instance; `main/index.ts` configures and starts it, handlers call into it. */
export const scheduler = new SubscriptionScheduler()
