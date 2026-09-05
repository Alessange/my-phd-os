import { compareInstants } from '../dates/instant'
import { calculateDeadlineStatus, type DeadlineStatusResult } from '../deadline-status'
import type {
  DeadlineStatus,
  PersonalDeadline,
  PersonalDeadlineCategory,
  Priority
} from '../types/personalDeadline'

/**
 * Pure view logic for the Personal Deadlines tab (spec §13.3) and the summary (§14): computed
 * status per deadline, scope/attribute filters, the six sort orders, and the summary counts.
 */

export interface DescribedDeadline {
  deadline: PersonalDeadline
  computed: DeadlineStatusResult
}

export const describeDeadlines = (
  deadlines: readonly PersonalDeadline[],
  nowIso: string
): DescribedDeadline[] =>
  deadlines.map((deadline) => ({ deadline, computed: calculateDeadlineStatus(deadline, nowIso) }))

export const DEADLINE_SCOPES = ['active', 'upcoming', 'overdue', 'completed', 'all'] as const
export type DeadlineScope = (typeof DEADLINE_SCOPES)[number]
export const DEADLINE_SCOPE_LABELS: Readonly<Record<DeadlineScope, string>> = {
  active: 'Active',
  upcoming: 'Upcoming',
  overdue: 'Overdue',
  completed: 'Completed',
  all: 'All'
}

export interface DeadlineFilters {
  scope: DeadlineScope
  category?: PersonalDeadlineCategory
  priority?: Priority
  /** Computed status (`on_track`, `at_risk`, …), not the stored one. */
  status?: DeadlineStatus
  tag?: string
}

export const DEFAULT_DEADLINE_FILTERS: DeadlineFilters = { scope: 'active' }

const inScope = (item: DescribedDeadline, scope: DeadlineScope): boolean => {
  const completed = item.deadline.status === 'completed'
  switch (scope) {
    case 'all':
      return true
    case 'completed':
      return completed
    case 'active':
      return !completed
    case 'overdue':
      return item.computed.status === 'overdue'
    case 'upcoming':
      return !completed && !item.computed.remaining.isPast
  }
}

export const filterDeadlines = (
  items: readonly DescribedDeadline[],
  filters: DeadlineFilters
): DescribedDeadline[] =>
  items.filter(
    (item) =>
      inScope(item, filters.scope) &&
      (filters.category === undefined || item.deadline.category === filters.category) &&
      (filters.priority === undefined || item.deadline.priority === filters.priority) &&
      (filters.status === undefined || item.computed.status === filters.status) &&
      (filters.tag === undefined || (item.deadline.tags ?? []).includes(filters.tag))
  )

export const DEADLINE_SORTS = [
  'nearest',
  'farthest',
  'priority',
  'progress',
  'risk',
  'recent'
] as const
export type DeadlineSort = (typeof DEADLINE_SORTS)[number]
export const DEADLINE_SORT_LABELS: Readonly<Record<DeadlineSort, string>> = {
  nearest: 'Nearest first',
  farthest: 'Farthest first',
  priority: 'Highest priority',
  progress: 'Lowest work progress',
  risk: 'Most at risk',
  recent: 'Recently created'
}

const PRIORITY_RANK: Readonly<Record<Priority, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
}
/** Most worrying first; the status rules already encode urgency, this only orders them. */
const RISK_RANK: Readonly<Record<DeadlineStatus, number>> = {
  overdue: 0,
  urgent: 1,
  at_risk: 2,
  behind: 3,
  on_track: 4,
  ahead: 5,
  completed: 6
}

type Comparator = (a: DescribedDeadline, b: DescribedDeadline) => number

const byNearest: Comparator = (a, b) =>
  compareInstants(a.deadline.deadlineAt, b.deadline.deadlineAt) ||
  a.deadline.title.localeCompare(b.deadline.title)

const COMPARATORS: Readonly<Record<DeadlineSort, Comparator>> = {
  nearest: byNearest,
  farthest: (a, b) => compareInstants(b.deadline.deadlineAt, a.deadline.deadlineAt),
  priority: (a, b) => PRIORITY_RANK[a.deadline.priority] - PRIORITY_RANK[b.deadline.priority],
  progress: (a, b) => a.deadline.progress - b.deadline.progress,
  risk: (a, b) =>
    RISK_RANK[a.computed.status] - RISK_RANK[b.computed.status] ||
    a.computed.paceDifference - b.computed.paceDifference,
  recent: (a, b) => compareInstants(b.deadline.createdAt, a.deadline.createdAt)
}

/** Stable: ties fall back to nearest deadline, then title. */
export const sortDeadlines = (
  items: readonly DescribedDeadline[],
  sort: DeadlineSort
): DescribedDeadline[] => {
  const primary = COMPARATORS[sort]
  return [...items].sort((a, b) => primary(a, b) || byNearest(a, b))
}

export const collectTags = (deadlines: readonly PersonalDeadline[]): string[] =>
  [...new Set(deadlines.flatMap((d) => d.tags ?? []))].sort((a, b) => a.localeCompare(b))

/** The next deadline that is neither completed nor already past. */
export const nearestUpcomingDeadline = (
  items: readonly DescribedDeadline[]
): DescribedDeadline | undefined =>
  items
    .filter((item) => item.deadline.status !== 'completed' && !item.computed.remaining.isPast)
    .sort(byNearest)[0]

export interface DeadlineSummaryCounts {
  active: number
  /** Active, not past, and due before `weekEndIso`. */
  dueThisWeek: number
  /** Active deadlines that need attention: at risk, urgent or overdue. */
  atRisk: number
  completed: number
  nearest?: DescribedDeadline
}

/** `weekEndIso` is the exclusive end instant of the current local week. */
export const summarizeDeadlines = (
  items: readonly DescribedDeadline[],
  weekEndIso: string
): DeadlineSummaryCounts => {
  const active = items.filter((item) => item.deadline.status !== 'completed')
  return {
    active: active.length,
    dueThisWeek: active.filter(
      (item) =>
        !item.computed.remaining.isPast && compareInstants(item.deadline.deadlineAt, weekEndIso) < 0
    ).length,
    atRisk: active.filter((item) => ['at_risk', 'urgent', 'overdue'].includes(item.computed.status))
      .length,
    completed: items.length - active.length,
    nearest: nearestUpcomingDeadline(items)
  }
}
