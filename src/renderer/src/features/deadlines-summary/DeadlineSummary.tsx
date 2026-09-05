import { useQuery } from '@tanstack/react-query'
import { Bookmark, CalendarClock, CheckCheck, Flame, ListTodo, type LucideIcon } from 'lucide-react'
import { addDays, startOfDayInZone, startOfWeek, todayInZone } from '@shared/dates'
import { describeDeadlines, summarizeDeadlines } from '@shared/personal-deadlines/views'
import { useNavigation } from '@renderer/app/navigation'
import { Countdown } from '@renderer/components/common/Countdown'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { usePersonalDeadlines } from '@renderer/features/personal-deadlines/api'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { cn } from '@renderer/lib/utils'

interface StatProps {
  icon: LucideIcon
  label: string
  value: number
  /** Keeps personal and conference figures visibly apart (spec §14). */
  group: 'Personal' | 'Conferences'
  hint?: string
  emphasis?: boolean
}

function Stat({ icon: Icon, label, value, group, hint, emphasis }: StatProps): React.JSX.Element {
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 shadow-xs"
      title={hint}
      data-summary={label}
    >
      <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{group}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <span
        className={cn(
          'tabular text-xl font-semibold',
          emphasis && value > 0 && 'text-status-at-risk'
        )}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Compact summary above the Deadlines tabs (spec §14), derived from real data only: personal
 * active / due this week / at risk / completed counts, the nearest personal deadline, and the
 * number of followed conference deadlines. Renders nothing on a fresh install so the page opens
 * on the tabs' empty states instead of a row of zeros.
 */
export function DeadlineSummary(): React.JSX.Element | null {
  const format = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const navigate = useNavigation((state) => state.navigate)
  const personal = usePersonalDeadlines({ includeCompleted: true })
  const followed = useQuery({
    queryKey: queryKeys.conferences.followed(),
    queryFn: () => api('conferences:listFollowed')
  })

  if (personal.isPending || followed.isPending) return null
  if (personal.isError) {
    return (
      <ErrorState
        variant="compact"
        error={personal.error}
        title="Deadline summary unavailable"
        onRetry={() => void personal.refetch()}
      />
    )
  }
  const deadlines = personal.data
  const followedCount = followed.data?.length ?? 0
  if (deadlines.length === 0 && followedCount === 0 && !followed.isError) return null

  const todayKey = todayInZone(format.zone, nowIso)
  const weekEnd = startOfDayInZone(
    addDays(startOfWeek(todayKey, format.settings.weekStartsOn), 7),
    format.zone
  )
  const summary = summarizeDeadlines(describeDeadlines(deadlines, nowIso), weekEnd)

  return (
    <section aria-label="Deadline summary" className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      <Stat icon={ListTodo} label="Active" value={summary.active} group="Personal" />
      <Stat
        icon={CalendarClock}
        label="Due this week"
        value={summary.dueThisWeek}
        group="Personal"
      />
      <Stat
        icon={Flame}
        label="At risk"
        value={summary.atRisk}
        group="Personal"
        hint="At risk, urgent or overdue"
        emphasis
      />
      <Stat icon={CheckCheck} label="Completed" value={summary.completed} group="Personal" />
      <div
        className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 shadow-xs"
        data-summary="Nearest deadline"
      >
        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Personal</span>
        <span className="text-xs text-muted-foreground">Nearest deadline</span>
        {summary.nearest ? (
          <button
            type="button"
            className="flex min-w-0 flex-col items-start rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() =>
              navigate('deadlines', { tab: 'personal', id: summary.nearest?.deadline.id ?? '' })
            }
          >
            <span className="w-full truncate text-sm font-semibold">
              {summary.nearest.deadline.title}
            </span>
            <Countdown
              targetIso={summary.nearest.deadline.deadlineAt}
              variant="inline"
              className="text-xs text-muted-foreground"
            />
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">None upcoming</span>
        )}
      </div>
      {followed.isError ? (
        <ErrorState
          variant="compact"
          error={followed.error}
          title="Followed conferences unavailable"
          onRetry={() => void followed.refetch()}
        />
      ) : (
        <Stat
          icon={Bookmark}
          label="Followed conferences"
          value={followedCount}
          group="Conferences"
        />
      )}
    </section>
  )
}
