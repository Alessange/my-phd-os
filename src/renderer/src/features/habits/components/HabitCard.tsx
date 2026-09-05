import { Archive, ArchiveRestore, Flame, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildCompletionGrid, calculateHabitStats, toCompletedSet } from '@shared/habits/streaks'
import type { Habit, HabitCompletion } from '@shared/types/habit'
import { DynamicIcon } from '@renderer/components/common/DynamicIcon'
import { ProgressBar } from '@renderer/components/common/ProgressBar'
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
import { Switch } from '@renderer/components/ui/switch'
import { useFormat } from '@renderer/hooks/useFormat'
import { clampPercent, cn } from '@renderer/lib/utils'
import { useDeleteHabit, useSetArchived, useSetCompletion } from '../api'

const WD_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun'
}

const frequencyLabel = (habit: Habit): string => {
  const f = habit.frequency
  if (f.type === 'daily') return 'Daily'
  if (f.type === 'weekly') return `${f.targetCount}× / week`
  return f.days.map((d) => WD_SHORT[d] ?? String(d)).join(', ')
}

const HEATMAP_WEEKS = 10

export interface HabitCardProps {
  habit: Habit
  completions: HabitCompletion[]
  todayKey: string
  onEdit: (habit: Habit) => void
}

/**
 * One habit: identity, current/longest streak, this week's progress, and a small completion heatmap.
 * The Today toggle marks today complete (or undoes it). Archive/Delete live in a small menu;
 * Delete asks for confirmation first (ARCHITECTURE §12.5).
 */
export function HabitCard({
  habit,
  completions,
  todayKey,
  onEdit
}: HabitCardProps): React.JSX.Element {
  const { settings } = useFormat()
  const setCompletion = useSetCompletion()
  const setArchived = useSetArchived()
  const remove = useDeleteHabit()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const stats = useMemo(
    () => calculateHabitStats(habit, completions, todayKey, settings.weekStartsOn),
    [habit, completions, todayKey, settings.weekStartsOn]
  )
  const grid = useMemo(
    () =>
      buildCompletionGrid(
        toCompletedSet(completions),
        todayKey,
        HEATMAP_WEEKS,
        settings.weekStartsOn
      ),
    [completions, todayKey, settings.weekStartsOn]
  )

  const weekPct = stats.weekTarget > 0 ? clampPercent((stats.weekDone / stats.weekTarget) * 100) : 0
  const archived = habit.archivedAt !== undefined

  const toggleToday = (checked: boolean): void => {
    setCompletion.mutate({ habitId: habit.id, date: todayKey, completed: checked })
  }

  const confirmRemove = (): void => {
    remove.mutate({ id: habit.id }, { onSettled: () => setConfirmDelete(false) })
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-xs"
      data-habit-id={habit.id}
      data-archived={archived || undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-white"
            style={{ backgroundColor: habit.color }}
          >
            {habit.icon && <DynamicIcon name={habit.icon} className="size-4" />}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{habit.name}</h3>
            <p className="text-xs text-muted-foreground">{frequencyLabel(habit)}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${habit.name}`}>
              <MoreVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(habit)}>
              <Pencil aria-hidden="true" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setArchived.mutate({ id: habit.id, archived: !archived })}
            >
              {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
              {archived ? 'Unarchive' : 'Archive'}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Flame className="size-4 text-priority-high" aria-hidden="true" />
          <span className="tabular text-sm font-medium">{stats.current}</span>
          <span className="text-xs text-muted-foreground">current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Best</span>
          <span className="tabular text-sm font-medium">{stats.longest}</span>
        </div>
      </div>

      <ProgressBar
        value={weekPct}
        label="This week"
        valueText={`${stats.weekDone} / ${stats.weekTarget}`}
        size="sm"
      />

      <div>
        <div className="mb-1 text-xs text-muted-foreground">Last {HEATMAP_WEEKS} weeks</div>
        <div className="flex gap-[3px] overflow-x-auto" role="img" aria-label="Completion heatmap">
          {grid.map((week) => (
            <div key={week.startKey} className="flex flex-col gap-[3px]">
              {week.days.map((cell) => (
                <span
                  key={cell.dateKey}
                  title={`${cell.dateKey}${cell.completed ? ' · done' : cell.future ? '' : ' · missed'}`}
                  className={cn(
                    'size-[11px] rounded-[3px]',
                    cell.future ? 'bg-transparent' : cell.completed ? 'opacity-100' : 'bg-muted'
                  )}
                  style={cell.completed ? { backgroundColor: habit.color } : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {stats.dueToday && !archived && (
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-xs text-muted-foreground">Done today</span>
          <Switch
            checked={stats.completedToday}
            onCheckedChange={toggleToday}
            disabled={setCompletion.isPending}
            aria-label={`Mark ${habit.name} done today`}
          />
        </div>
      )}

      {archived && (
        <p className="text-xs text-muted-foreground">
          Archived: hidden from Today, streaks frozen.
        </p>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{habit.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the habit and its whole completion history from this computer. It cannot
              be undone. Archive it instead if you only want it out of the way.
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
    </div>
  )
}
