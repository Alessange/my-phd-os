import { Fragment, type ReactNode } from 'react'
import { addDays, startOfDayInZone, startOfWeek, todayInZone } from '@shared/dates'
import { describeDeadlines, summarizeDeadlines } from '@shared/personal-deadlines/views'
import { useNavigation } from '@renderer/app/navigation'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { usePersonalDeadlines } from '@renderer/features/personal-deadlines/api'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'

/** One figure of the sentence: the numeral keeps the `tabular` class the tests read. */
function Figure({
  label,
  value,
  children,
  title
}: {
  label: string
  value: number
  /** Words after the numeral (`active`, `at risk`). */
  children: ReactNode
  title?: string
}): React.JSX.Element {
  return (
    <span data-summary={label} title={title}>
      <span className="tabular">{value}</span> {children}
    </span>
  )
}

/**
 * The Personal tab's lead sentence (spec §14, DESIGN.md 8.2), derived from real data only:
 * `7 active · 1 due this week · 5 at risk (1 overdue) · 1 completed · Next: Visa renewal in 17 h 59 m`.
 * It replaces the six KPI tiles; the numbers stay readable by role and by `data-summary`. Renders
 * nothing on a fresh install so the page opens on the tab's empty state instead of a row of zeros.
 */
export function DeadlineSummary(): React.JSX.Element | null {
  const format = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const navigate = useNavigation((state) => state.navigate)
  const personal = usePersonalDeadlines({ includeCompleted: true })

  if (personal.isPending) return null
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
  if (deadlines.length === 0) return null

  const todayKey = todayInZone(format.zone, nowIso)
  const weekEnd = startOfDayInZone(
    addDays(startOfWeek(todayKey, format.settings.weekStartsOn), 7),
    format.zone
  )
  const described = describeDeadlines(deadlines, nowIso)
  const summary = summarizeDeadlines(described, weekEnd)
  const overdue = described.filter(
    (item) => item.deadline.status !== 'completed' && item.computed.status === 'overdue'
  ).length
  const nearest = summary.nearest

  const parts: ReactNode[] = [
    <Figure key="active" label="Active" value={summary.active}>
      active
    </Figure>,
    <Figure key="week" label="Due this week" value={summary.dueThisWeek}>
      due this week
    </Figure>,
    <Figure key="risk" label="At risk" value={summary.atRisk} title="At risk, urgent or overdue">
      at risk
      {overdue > 0 && (
        <>
          {' '}
          (<span className="tabular">{overdue}</span> overdue)
        </>
      )}
    </Figure>,
    <Figure key="done" label="Completed" value={summary.completed}>
      completed
    </Figure>,
    <span key="next" data-summary="Nearest deadline">
      {nearest ? (
        <>
          Next:{' '}
          <button
            type="button"
            className="link app-no-drag"
            onClick={() => navigate('deadlines', { tab: 'personal', id: nearest.deadline.id })}
          >
            {nearest.deadline.title}
          </button>{' '}
          <span className="tabular">
            in {format.formatCountdown(nearest.deadline.deadlineAt, nowIso, 'compact')}
          </span>
        </>
      ) : (
        'No upcoming deadline'
      )}
    </span>
  ]

  return (
    <section aria-label="Deadline summary" className="text-lead text-ink">
      <p>
        {parts.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && <span className="text-ink-3"> · </span>}
            {part}
          </Fragment>
        ))}
      </p>
    </section>
  )
}
