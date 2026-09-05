import { Check } from 'lucide-react'
import { useState } from 'react'
import type { CreateHabitInput, UpdateHabitInput } from '@shared/schemas/habit'
import type { Habit, HabitFrequencyType } from '@shared/types/habit'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { Button } from '@renderer/components/ui/button'
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'
import { useCreateHabit, useUpdateHabit } from '../api'
import { HABIT_ICON_ENTRIES } from '../icons'

const COLOR_PRESETS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#64748b'
] as const

const WD_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun'
}

const isHex = (v: string): boolean => /^#[0-9a-fA-F]{6}$/.test(v)

interface FormState {
  name: string
  color: string
  icon?: string
  frequencyType: HabitFrequencyType
  targetCount: number
  days: number[]
}

const fromHabit = (habit: Habit): FormState => ({
  name: habit.name,
  color: habit.color,
  icon: habit.icon,
  frequencyType: habit.frequency.type,
  targetCount: habit.frequency.type === 'weekly' ? habit.frequency.targetCount : 3,
  days: habit.frequency.type === 'specific_days' ? [...habit.frequency.days] : []
})

const empty: FormState = {
  name: '',
  color: COLOR_PRESETS[0],
  icon: undefined,
  frequencyType: 'daily',
  targetCount: 3,
  days: []
}

export interface HabitFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the form edits this habit; otherwise it creates a new one. */
  habit?: Habit
}

/**
 * Create or edit a habit. The frequency picker switches between daily, a weekly target count, and
 * specific weekdays (ordered by the week-start setting). Icon and colour are optional identity.
 * Validation mirrors the Zod schema; the main process re-validates and surfaces errors as toasts.
 */
export function HabitForm({ open, onOpenChange, habit }: HabitFormProps): React.JSX.Element {
  const { orderedWeekdays } = useFormat()
  const create = useCreateHabit()
  const update = useUpdateHabit()
  const [state, setState] = useState<FormState>(empty)
  // Reset the form when the dialog opens or switches target — derived during render, not in an
  // effect, so a stale draft never lingers across open/close cycles (see SettingsPage).
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevHabit, setPrevHabit] = useState(habit)
  if (open !== prevOpen || habit !== prevHabit) {
    setPrevOpen(open)
    setPrevHabit(habit)
    if (open) setState(habit ? fromHabit(habit) : empty)
  }

  const patch = (p: Partial<FormState>): void => setState((s) => ({ ...s, ...p }))

  const toggleDay = (wd: number): void =>
    setState((s) => ({
      ...s,
      days: s.days.includes(wd)
        ? s.days.filter((d) => d !== wd)
        : [...s.days, wd].sort((a, b) => a - b)
    }))

  const nameValid = state.name.trim().length > 0
  const colorValid = isHex(state.color)
  const weeklyValid =
    state.frequencyType !== 'weekly' || (state.targetCount >= 1 && state.targetCount <= 7)
  const daysValid = state.frequencyType !== 'specific_days' || state.days.length >= 1
  const canSubmit =
    nameValid && colorValid && weeklyValid && daysValid && !create.isPending && !update.isPending

  const buildInput = (): CreateHabitInput => {
    const base = { name: state.name.trim(), color: state.color, icon: state.icon }
    if (state.frequencyType === 'daily') return { ...base, frequency: { type: 'daily' } }
    if (state.frequencyType === 'weekly')
      return { ...base, frequency: { type: 'weekly', targetCount: state.targetCount } }
    return { ...base, frequency: { type: 'specific_days', days: state.days } }
  }

  const submit = async (): Promise<void> => {
    if (!canSubmit) return
    try {
      if (habit) {
        // `icon: null` clears the icon on update; `undefined` would leave the stored value untouched.
        const patch: UpdateHabitInput = { ...buildInput(), icon: state.icon ?? null }
        await update.mutateAsync({ id: habit.id, patch })
      } else {
        await create.mutateAsync(buildInput())
      }
      onOpenChange(false)
    } catch {
      // Already reported by the mutation's onError toast (with Retry); keep the dialog open so the
      // draft can be corrected.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{habit ? 'Edit habit' : 'Create habit'}</DialogTitle>
          <DialogDescription>
            Habits are intentionally simple — a name, a colour, and how often you aim to do it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Exercise, Reading, Deep Work"
              autoComplete="off"
              aria-invalid={!nameValid}
            />
            {!nameValid && state.name.length > 0 && (
              <p className="text-xs text-destructive">Name is required.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Colour</Label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={state.color === c}
                  onClick={() => patch({ color: c })}
                  className={cn(
                    'size-6 rounded-full border-2 transition-transform',
                    state.color === c
                      ? 'border-foreground ring-2 ring-ring ring-offset-1'
                      : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Input
                  type="color"
                  value={isHex(state.color) ? state.color : '#3b82f6'}
                  onChange={(e) => patch({ color: e.target.value })}
                  className="size-7 w-auto p-0"
                  aria-label="Custom colour"
                />
                Custom
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Icon (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_ICON_ENTRIES.map(({ value, Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-label={value}
                  aria-pressed={state.icon === value}
                  onClick={() => patch({ icon: state.icon === value ? undefined : value })}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-md border transition-colors',
                    state.icon === value
                      ? 'border-foreground bg-accent text-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Frequency</Label>
            <SegmentedControl
              aria-label="Frequency"
              value={state.frequencyType}
              onValueChange={(v) => patch({ frequencyType: v })}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly target' },
                { value: 'specific_days', label: 'Specific days' }
              ]}
            />
            {state.frequencyType === 'weekly' && (
              <div className="flex items-center gap-2 pt-1">
                <Label htmlFor="habit-target" className="shrink-0">
                  Times per week
                </Label>
                <Input
                  id="habit-target"
                  type="number"
                  min={1}
                  max={7}
                  value={state.targetCount}
                  onChange={(e) => patch({ targetCount: Number(e.target.value) || 0 })}
                  className="w-20"
                  aria-invalid={!weeklyValid}
                />
                <span className="text-xs text-muted-foreground">1–7</span>
              </div>
            )}
            {state.frequencyType === 'specific_days' && (
              <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Weekdays">
                {orderedWeekdays().map((wd) => {
                  const active = state.days.includes(wd)
                  return (
                    <button
                      key={wd}
                      type="button"
                      aria-pressed={active}
                      aria-label={WD_SHORT[wd]}
                      onClick={() => toggleDay(wd)}
                      className={cn(
                        'h-9 min-w-9 rounded-md border px-2 text-xs font-medium transition-colors',
                        active
                          ? 'border-foreground bg-accent text-foreground'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {WD_SHORT[wd]}
                    </button>
                  )
                })}
                {!daysValid && (
                  <p className="w-full text-xs text-destructive">Pick at least one day.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            <Check aria-hidden="true" />
            {habit ? 'Save changes' : 'Create habit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
