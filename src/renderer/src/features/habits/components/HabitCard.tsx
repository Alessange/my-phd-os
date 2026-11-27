import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { todayInZone } from '@shared/dates'
import {
  buildCompletionGrid,
  calculateHabitStats,
  isDueOn,
  toCompletedSet
} from '@shared/habits/streaks'
import type { Habit, HabitCompletion } from '@shared/types/habit'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Progress } from '@renderer/components/ui/progress'
import { Row } from '@renderer/components/ui/row'
import { useFormat } from '@renderer/hooks/useFormat'
import { toastUndo } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { useDeleteHabit, useSetArchived, useSetCompletion } from '../api'
import { HEATMAP_WEEKS, WD_SHORT, frequencyLabel, streakUnit, weekProgress } from '../habitDisplay'

/**
 * Column template shared by the page's column heads and every habit row, so they line up:
 * name (flexible) | 10-week grid | this week | streak | row menu.
 */
export const HABIT_ROW_COLUMNS =
  'grid grid-cols-[minmax(0,372px)_149px_120px_minmax(104px,1fr)_32px] items-center gap-x-6 min-[1100px]:gap-x-10'

export interface HabitCardProps {
  habit: Habit
  completions: HabitCompletion[]
  todayKey: string
  onEdit: (habit: Habit) => void
  /** The one habit still to do next: the only text on the page set in bold. */
  next?: boolean
  /** Print the weekday labels beside the grid (first row only). */
  weekdayLabels?: boolean
}

/**
 * One habit as a hairline row: a single done control, the name and cadence, the last 10 weeks as a
 * quiet grid, this week's progress, and the streak. Archive / Delete live in a row menu that shows on
 * hover and focus; Delete asks for confirmation first (ARCHITECTURE section 12.5). Archived habits
 * render as a plain text row without a grid.
 */
export function HabitCard({
  habit,
  completions,
  todayKey,
  onEdit,
  next = false,
  weekdayLabels = false
}: HabitCardProps): React.JSX.Element {
  const { settings, zone, formatDate, orderedWeekdays } = useFormat()
  const setCompletion = useSetCompletion()
  const setArchived = useSetArchived()
  const remove = useDeleteHabit()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const archived = habit.archivedAt !== undefined

  const completedSet = useMemo(() => toCompletedSet(completions), [completions])
  const stats = useMemo(
    () => calculateHabitStats(habit, completions, todayKey, settings.weekStartsOn),
    [habit, completions, todayKey, settings.weekStartsOn]
  )
  const grid = useMemo(
    () => buildCompletionGrid(completedSet, todayKey, HEATMAP_WEEKS, settings.weekStartsOn),
    [completedSet, todayKey, settings.weekStartsOn]
  )
  const week = useMemo(
    () => weekProgress(habit, completedSet, todayKey, settings.weekStartsOn),
    [habit, completedSet, todayKey, settings.weekStartsOn]
  )
  // Days before the habit existed (or its first recorded completion) were never scheduled.
  const sinceKey = useMemo(() => {
    let since = todayInZone(zone, habit.createdAt)
    for (const key of completedSet) if (key < since) since = key
    return since
  }, [zone, habit.createdAt, completedSet])
  const doneInGrid = grid.reduce((n, w) => n + w.days.filter((d) => d.completed).length, 0)

  const toggleToday = (): void => {
    setCompletion.mutate({ habitId: habit.id, date: todayKey, completed: !stats.completedToday })
  }

  const confirmRemove = (): void => {
    remove.mutate({ id: habit.id }, { onSettled: () => setConfirmDelete(false) })
  }

  const archive = (): void => {
    setArchived.mutate(
      { id: habit.id, archived: true },
      {
        onSuccess: () =>
          toastUndo(`Archived “${habit.name}”`, () =>
            setArchived.mutateAsync({ id: habit.id, archived: false })
          )
      }
    )
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${habit.name}`}
          className={cn(
            'transition-opacity duration-100 data-[state=open]:opacity-100',
            'group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100',
            archived ? 'opacity-100' : 'opacity-0'
          )}
        >
          <span className="text-lead" aria-hidden="true">
            …
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(habit)}>Edit</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            archived ? setArchived.mutate({ id: habit.id, archived: false }) : archive()
          }
        >
          {archived ? 'Unarchive' : 'Archive'}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const deleteDialog = (
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{habit.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the habit and its whole completion history from this computer. It cannot be
            undone. Archive it instead if you only want it out of the way.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault()
              confirmRemove()
            }}
          >
            Delete habit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (archived) {
    return (
      <Row asChild className="justify-between gap-6 py-2">
        <li data-habit-id={habit.id} data-archived="true">
          <div className="flex min-w-0 flex-1 items-baseline gap-4">
            <span className="min-w-0 truncate text-body text-ink-3">{habit.name}</span>
            <span className="shrink-0 text-meta text-ink-3">{frequencyLabel(habit)}</span>
          </div>
          <span className="tabular shrink-0 text-meta text-ink-3">Best {stats.longest}</span>
          {menu}
          {deleteDialog}
        </li>
      </Row>
    )
  }

  const done = stats.completedToday
  const pct = week.target > 0 ? (week.done / week.target) * 100 : 0
  const weekdays = orderedWeekdays()
  /** Active rows sit straight under the page h1; archived ones under the Archived h2. */
  const Title = archived ? 'h3' : 'h2'

  return (
    <Row asChild density="lead" className={cn(HABIT_ROW_COLUMNS, 'min-h-28 py-3')}>
      <li data-habit-id={habit.id}>
        <div className="flex min-w-0 items-start gap-5">
          {stats.dueToday ? (
            <button
              type="button"
              role="switch"
              aria-checked={done}
              aria-label={`Mark ${habit.name} done today`}
              onClick={toggleToday}
              className={cn(
                'mt-px flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-100',
                done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-edge text-transparent hover:border-ink hover:text-ink-4'
              )}
            >
              {done && <Check className="size-4" aria-hidden="true" />}
            </button>
          ) : (
            <span className="size-7 shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <Title
              className={cn(
                'text-lead break-words',
                done ? 'text-ink-3' : 'text-ink',
                next && 'font-bold'
              )}
            >
              {habit.name}
            </Title>
            <p className="text-meta text-ink-3">
              {frequencyLabel(habit)}
              {!stats.dueToday && ' · not scheduled today'}
            </p>
          </div>
        </div>

        <div
          className="flex gap-2"
          role="img"
          aria-label={`${habit.name}: last ${HEATMAP_WEEKS} weeks, ${doneInGrid} ${doneInGrid === 1 ? 'day' : 'days'} done`}
        >
          <div className="grid w-3.5 grid-rows-7 gap-y-[3px]" aria-hidden="true">
            {weekdays.map((wd, index) => (
              <span key={wd} className="text-meta leading-[10px] text-ink-3">
                {weekdayLabels && index < 5 && index % 2 === 0
                  ? (WD_SHORT[wd] ?? '').slice(0, 1)
                  : ''}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-row grid-cols-10 gap-[3px]">
            {weekdays.map((_, dayIndex) =>
              grid.map((weekColumn) => {
                const cell = weekColumn.days[dayIndex]
                if (!cell) return null
                const scheduled =
                  !cell.future &&
                  (cell.completed ||
                    (isDueOn(habit.frequency, cell.dateKey) && cell.dateKey >= sinceKey))
                const isToday = cell.dateKey === todayKey
                const state = cell.completed
                  ? 'done'
                  : cell.future
                    ? 'upcoming'
                    : scheduled
                      ? 'not done'
                      : 'not scheduled'
                return (
                  <span
                    key={cell.dateKey}
                    title={`${formatDate(cell.dateKey)} · ${state}`}
                    className={cn(
                      'block size-2.5 rounded-xs',
                      cell.completed ? 'bg-cell-done' : scheduled && 'bg-cell-miss',
                      isToday && 'outline outline-1 outline-offset-2 outline-ink'
                    )}
                  />
                )
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-lead tabular">
            {week.target > 0 ? `${week.done} of ${week.target}` : 'Not yet due'}
          </span>
          <Progress value={pct} aria-label="This week" className="w-[120px]" />
        </div>

        <div className="flex flex-col items-end">
          <span className="flex items-baseline justify-end gap-2">
            <span className="text-display tabular">{stats.current}</span>
            <span className="w-10 text-body text-ink-2">{streakUnit(habit, stats.current)}</span>
          </span>
          <span className="tabular pr-12 text-meta text-ink-3">Best {stats.longest}</span>
        </div>

        {menu}
        {deleteDialog}
      </li>
    </Row>
  )
}
