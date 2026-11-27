import { ChevronDown, CircleAlert } from 'lucide-react'
import { useState } from 'react'
import type { CreateHabitInput, UpdateHabitInput } from '@shared/schemas/habit'
import type { Habit, HabitFrequencyType } from '@shared/types/habit'
import { ColourSwatchPicker } from '@renderer/components/common/ColourSwatchPicker'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { propertyRowClass } from '@renderer/components/ui/property-row'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { useFormat } from '@renderer/hooks/useFormat'
import { COLOUR_SWATCHES } from '@renderer/lib/colourSwatches'
import { cn, userColor } from '@renderer/lib/utils'
import { useCreateHabit, useUpdateHabit } from '../api'
import { WD_SHORT } from '../habitDisplay'

/** The schema stores 3 or 6 digit hex; both are valid, a stored value is never rewritten. */
const isHex = (v: string): boolean => /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(v)

/** The native colour input only takes `#rrggbb`. */
const toLongHex = (v: string): string =>
  /^#[0-9a-fA-F]{3}$/.test(v) ? `#${[...v.slice(1)].map((c) => c + c).join('')}` : v

interface FormState {
  name: string
  color: string
  /** Stored lucide name. No longer editable here; carried through so an edit never clears it. */
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
  color: COLOUR_SWATCHES[0],
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
 * Create or edit a habit: a name and how often, then quiet property rows. Colour is a 6 px dot that
 * opens a swatch popover (the stored hex is kept as chosen); the icon picker is gone but a stored
 * icon is preserved on edit. Validation mirrors the Zod schema and never shows on a pristine field;
 * Enter submits.
 */
export function HabitForm({ open, onOpenChange, habit }: HabitFormProps): React.JSX.Element {
  const { orderedWeekdays } = useFormat()
  const create = useCreateHabit()
  const update = useUpdateHabit()
  const [state, setState] = useState<FormState>(empty)
  const [nameTouched, setNameTouched] = useState(false)
  const [daysTouched, setDaysTouched] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  // Reset the form when the dialog opens or switches target — derived during render, not in an
  // effect, so a stale draft never lingers across open/close cycles (see SettingsPage).
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevHabit, setPrevHabit] = useState(habit)
  if (open !== prevOpen || habit !== prevHabit) {
    setPrevOpen(open)
    setPrevHabit(habit)
    if (open) {
      setState(habit ? fromHabit(habit) : empty)
      setNameTouched(false)
      setDaysTouched(false)
      setColorOpen(false)
    }
  }

  const patch = (p: Partial<FormState>): void => setState((s) => ({ ...s, ...p }))

  const toggleDay = (wd: number): void => {
    setDaysTouched(true)
    setState((s) => ({
      ...s,
      days: s.days.includes(wd)
        ? s.days.filter((d) => d !== wd)
        : [...s.days, wd].sort((a, b) => a - b)
    }))
  }

  const nameValid = state.name.trim().length > 0
  const colorValid = isHex(state.color)
  const weeklyValid =
    state.frequencyType !== 'weekly' || (state.targetCount >= 1 && state.targetCount <= 7)
  const daysValid = state.frequencyType !== 'specific_days' || state.days.length >= 1
  const canSubmit =
    nameValid && colorValid && weeklyValid && daysValid && !create.isPending && !update.isPending
  const showNameError = nameTouched && !nameValid
  const showDaysError = daysTouched && !daysValid

  const buildInput = (): CreateHabitInput => {
    const base = { name: state.name.trim(), color: state.color, icon: state.icon }
    if (state.frequencyType === 'daily') return { ...base, frequency: { type: 'daily' } }
    if (state.frequencyType === 'weekly')
      return { ...base, frequency: { type: 'weekly', targetCount: state.targetCount } }
    return { ...base, frequency: { type: 'specific_days', days: state.days } }
  }

  const submit = async (): Promise<void> => {
    if (!canSubmit) {
      setNameTouched(true)
      setDaysTouched(true)
      return
    }
    try {
      if (habit) {
        // The stored icon and colour travel unchanged; `icon: null` (clear) is never sent.
        const input: UpdateHabitInput = buildInput()
        await update.mutateAsync({ id: habit.id, patch: input })
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
      <DialogContent size="md" aria-describedby={undefined}>
        <form
          className="flex flex-col gap-8"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{habit ? 'Edit habit' : 'Create habit'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              onBlur={() => {
                // A field that was never typed in stays pristine on blur; Enter still reports it.
                if (state.name.length > 0) setNameTouched(true)
              }}
              placeholder="e.g. Exercise, Reading, Deep Work"
              autoComplete="off"
              aria-invalid={showNameError || undefined}
              aria-describedby={showNameError ? 'habit-name-error' : undefined}
            />
            {showNameError && (
              <p id="habit-name-error" className="flex items-center gap-1.5 text-meta text-signal">
                <CircleAlert className="size-3.5" aria-hidden="true" />
                Name is required.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
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
          </div>

          <div className="flex flex-col">
            {state.frequencyType === 'weekly' && (
              <div className={propertyRowClass}>
                <Label htmlFor="habit-target" variant="inline">
                  Times per week
                </Label>
                <Input
                  id="habit-target"
                  type="number"
                  min={1}
                  max={7}
                  value={state.targetCount}
                  onChange={(e) => patch({ targetCount: Number(e.target.value) || 0 })}
                  className="w-16 text-right"
                  aria-invalid={!weeklyValid || undefined}
                />
              </div>
            )}

            {state.frequencyType === 'specific_days' && (
              <div className="flex flex-col gap-3 border-b border-line py-3">
                <span className="text-body text-ink">Weekdays</span>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Weekdays">
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
                          'h-9 min-w-11 rounded-sm px-2 text-body transition-colors duration-100',
                          active ? 'bg-track text-ink' : 'text-ink-3 hover:bg-hover hover:text-ink'
                        )}
                      >
                        {WD_SHORT[wd]}
                      </button>
                    )
                  })}
                </div>
                {showDaysError && (
                  <p className="flex items-center gap-1.5 text-meta text-signal">
                    <CircleAlert className="size-3.5" aria-hidden="true" />
                    Pick at least one day.
                  </p>
                )}
              </div>
            )}

            <Popover open={colorOpen} onOpenChange={setColorOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Colour"
                  className={cn(propertyRowClass, 'w-full text-left hover:bg-hover')}
                >
                  Colour
                  <span className="flex items-center gap-2">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: userColor(state.color) }}
                      aria-hidden="true"
                    />
                    <ChevronDown className="size-4 text-ink-3" aria-hidden="true" />
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-3">
                <ColourSwatchPicker
                  value={state.color}
                  onChange={(color) => patch({ color })}
                  label="Colour presets"
                />
                <label className="link-quiet mt-2 inline-flex text-meta has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink">
                  Custom colour…
                  <input
                    type="color"
                    value={toLongHex(isHex(state.color) ? state.color : COLOUR_SWATCHES[0])}
                    onChange={(e) => patch({ color: e.target.value })}
                    className="sr-only"
                    aria-label="Custom colour"
                  />
                </label>
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {habit ? 'Save changes' : 'Create habit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
