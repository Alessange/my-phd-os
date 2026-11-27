import { addDays, startOfDayInZone, startOfWeek, todayInZone } from '@shared/dates'
import type { DescribedDeadline } from '@shared/personal-deadlines/views'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { Progress } from '@renderer/components/ui/progress'
import { DeadlineCountdown } from '@renderer/features/conference-deadlines/components/DeadlineCountdown'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { clampPercent, cn } from '@renderer/lib/utils'
import { DeadlineMeta } from './DeadlineMeta'

export interface PersonalDeadlineListProps {
  items: DescribedDeadline[]
  onOpen: (deadline: PersonalDeadline) => void
  /** Group the rows under `Overdue`, `This week`, `Later` and `Completed` (only meaningful for the nearest-first sort). */
  grouped?: boolean
}

const GROUPS = ['Overdue', 'This week', 'Later', 'Completed'] as const
type Group = (typeof GROUPS)[number]

/** A labelled 2 px line with its value printed (`Time 96%`). */
function Line({
  label,
  value,
  name,
  indicatorClassName
}: {
  label: string
  value: number
  name: string
  indicatorClassName: string
}): React.JSX.Element {
  return (
    <span className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-3">
      <span className="text-meta text-ink-3">{label}</span>
      <Progress value={value} aria-label={name} indicatorClassName={indicatorClassName} size="sm" />
      <span className="text-meta tabular text-right text-ink-3">{clampPercent(value)}%</span>
    </span>
  )
}

/**
 * The reference rendering of Personal Deadlines (DESIGN.md 8.2): one hairline row per deadline with
 * the title and its category line, the due date, what remains, the two separate 2 px lines (time
 * gone, work done) and the status as a word. A single table, so it stays a table for assistive
 * technology; the column headers are read aloud but not drawn.
 */
export function PersonalDeadlineList({
  items,
  onOpen,
  grouped = true
}: PersonalDeadlineListProps): React.JSX.Element {
  const format = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const todayKey = todayInZone(format.zone, nowIso)
  const weekEnd = startOfDayInZone(
    addDays(startOfWeek(todayKey, format.settings.weekStartsOn), 7),
    format.zone
  )
  const weekEndMs = Date.parse(weekEnd)

  const groupOf = ({ deadline, computed }: DescribedDeadline): Group => {
    if (deadline.status === 'completed') return 'Completed'
    if (computed.status === 'overdue' || computed.remaining.isPast) return 'Overdue'
    return Date.parse(deadline.deadlineAt) < weekEndMs ? 'This week' : 'Later'
  }
  const sections: { title?: Group; rows: DescribedDeadline[] }[] = grouped
    ? GROUPS.map((title) => ({ title, rows: items.filter((i) => groupOf(i) === title) })).filter(
        (section) => section.rows.length > 0
      )
    : [{ rows: items }]

  return (
    <table className="w-full table-fixed border-collapse text-left [&_th]:font-normal">
      <caption className="sr-only">Personal deadlines</caption>
      <colgroup>
        <col />
        <col className="w-[190px] min-[1100px]:w-[236px]" />
        <col className="w-[120px] min-[1100px]:w-[150px]" />
        <col className="w-[220px] min-[1100px]:w-[272px]" />
        <col className="w-[104px] min-[1100px]:w-[124px]" />
      </colgroup>
      <thead className="sr-only">
        <tr>
          <th scope="col">Deadline</th>
          <th scope="col">Due</th>
          <th scope="col">Remaining</th>
          <th scope="col">Progress</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      {sections.map((section, sectionIndex) => (
        <tbody key={section.title ?? 'all'}>
          {section.title && (
            <tr>
              <th
                scope="rowgroup"
                colSpan={5}
                className={cn(
                  'text-body pb-1 text-left font-normal text-ink-2',
                  sectionIndex === 0 ? 'pt-0' : 'pt-8'
                )}
              >
                {section.title}
                <span className="tabular ml-2 text-ink-3">{section.rows.length}</span>
              </th>
            </tr>
          )}
          {section.rows.map((item, rowIndex) => {
            const { deadline, computed } = item
            const last =
              sectionIndex === sections.length - 1 && rowIndex === section.rows.length - 1
            const dueOwn = format.formatDateTimeWithZone(deadline.deadlineAt, deadline.timezone)
            const dueLocal = format.formatDateTimeWithZone(deadline.deadlineAt)
            const open = deadline.status !== 'completed'
            return (
              <tr
                key={deadline.id}
                className={cn(!last && 'border-b border-line')}
                data-deadline-id={deadline.id}
              >
                <td className="py-2.5 pr-4 align-middle">
                  <button
                    type="button"
                    className="text-lead line-clamp-2 text-left text-ink outline-offset-4 hover:underline"
                    title={deadline.title}
                    onClick={() => onOpen(deadline)}
                  >
                    {deadline.title}
                  </button>
                  <div>
                    <DeadlineMeta deadline={deadline} />
                  </div>
                </td>
                <td className="tabular py-2.5 pr-4 align-middle">
                  <div className="text-body text-ink-2">{dueOwn}</div>
                  {dueLocal !== dueOwn && (
                    <div className="text-meta text-ink-3">Local: {dueLocal}</div>
                  )}
                </td>
                <td className="py-2.5 pr-4 align-middle">
                  {open && computed.remaining.isPast ? (
                    <span className="text-body tabular text-ink">
                      {format.formatRelative(deadline.deadlineAt, nowIso)}
                    </span>
                  ) : (
                    <DeadlineCountdown targetIso={deadline.deadlineAt} size="compact" />
                  )}
                </td>
                <td className="py-2.5 pr-6 align-middle">
                  <span className="flex flex-col gap-1.5">
                    <Line
                      label="Time"
                      value={computed.timeProgress.clamped * 100}
                      name={`Time elapsed for ${deadline.title}`}
                      indicatorClassName="bg-progress-time"
                    />
                    <Line
                      label="Work"
                      value={deadline.progress}
                      name={`Work completed for ${deadline.title}`}
                      indicatorClassName="bg-progress-work"
                    />
                  </span>
                </td>
                <td className="py-2.5 text-right align-middle">
                  <StatusBadge
                    status={computed.status}
                    size="md"
                    attentionGlyphOnly
                    className="justify-end"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      ))}
    </table>
  )
}
