import { Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { getCategory } from '@shared/constants/categories'
import { MILESTONE_STATUS_DEFINITIONS } from '@shared/constants/statuses'
import {
  addDays,
  compareDateKeys,
  dateKeyInZone,
  isAllDayDate,
  startOfDayInZone,
  type ZoneInput
} from '@shared/dates'
import type { CreateMilestoneInput, UpdateMilestoneInput } from '@shared/schemas/milestone'
import {
  MILESTONE_CATEGORIES,
  type Milestone,
  type MilestoneCategory,
  type MilestoneStatus
} from '@shared/types/milestone'
import { DynamicIcon } from '@renderer/components/common/DynamicIcon'
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
import { Slider } from '@renderer/components/ui/slider'
import { Textarea } from '@renderer/components/ui/textarea'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { chipStyle, cn } from '@renderer/lib/utils'
import { useCreateMilestone, useDeleteMilestone, useUpdateMilestone } from '../api'

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

/** Default span of a new milestone: about a semester. */
const DEFAULT_SPAN_DAYS = 183

const isHex = (v: string): boolean => /^#[0-9a-fA-F]{6}$/.test(v)

const STATUS_OPTIONS = Object.values(MILESTONE_STATUS_DEFINITIONS).map((def) => ({
  value: def.id,
  label: def.label
}))

interface FormState {
  title: string
  description: string
  /** `YYYY-MM-DD` as typed into the date inputs. */
  start: string
  target: string
  category: MilestoneCategory
  status: MilestoneStatus
  progress: number
  color: string
}

const emptyFor = (today: string): FormState => ({
  title: '',
  description: '',
  start: today,
  target: addDays(today, DEFAULT_SPAN_DAYS),
  category: 'research',
  status: 'not_started',
  progress: 0,
  color: COLOR_PRESETS[0]
})

const fromMilestone = (m: Milestone, zone: ZoneInput): FormState => ({
  title: m.title,
  description: m.description ?? '',
  start: dateKeyInZone(m.startAt, zone),
  target: dateKeyInZone(m.targetAt, zone),
  category: m.category,
  status: m.status,
  progress: m.progress,
  color: m.color ?? COLOR_PRESETS[0]
})

export interface MilestoneFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the form edits (and can delete) this milestone; otherwise it creates a new one. */
  milestone?: Milestone
}

/**
 * Create or edit a milestone. Start/target are captured as local dates and normalised to the
 * instant at which that day starts in the user's timezone: milestones are coarse-grained (semester,
 * year), so a wall date is the natural unit. Validation mirrors the Zod schema; the main process
 * re-validates and the mutation hooks surface failures as toasts with Retry. Deleting confirms first.
 */
export function MilestoneForm({
  open,
  onOpenChange,
  milestone
}: MilestoneFormProps): React.JSX.Element {
  const { zone } = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const today = dateKeyInZone(nowIso, zone)
  const create = useCreateMilestone()
  const update = useUpdateMilestone()
  const remove = useDeleteMilestone()

  const [state, setState] = useState<FormState>(() => emptyFor(today))
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Reset the form when the dialog opens or switches target; derived during render, not in an
  // effect, so a stale draft never lingers across open/close cycles (see HabitForm / SettingsPage).
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevMilestone, setPrevMilestone] = useState(milestone)
  if (open !== prevOpen || milestone !== prevMilestone) {
    setPrevOpen(open)
    setPrevMilestone(milestone)
    if (open) {
      setState(milestone ? fromMilestone(milestone, zone) : emptyFor(today))
      setConfirmDelete(false)
    }
  }

  const patch = (p: Partial<FormState>): void => setState((s) => ({ ...s, ...p }))

  const titleValid = state.title.trim().length > 0
  const startValid = isAllDayDate(state.start)
  const targetValid = isAllDayDate(state.target)
  const orderValid = startValid && targetValid && compareDateKeys(state.start, state.target) < 0
  const busy = create.isPending || update.isPending || remove.isPending
  const canSubmit = titleValid && orderValid && !busy

  const buildInput = (): CreateMilestoneInput => ({
    title: state.title.trim(),
    description: state.description.trim() || undefined,
    startAt: startOfDayInZone(state.start, zone),
    targetAt: startOfDayInZone(state.target, zone),
    category: state.category,
    status: state.status,
    progress: state.progress,
    color: isHex(state.color) ? state.color : undefined
  })

  const submit = async (): Promise<void> => {
    if (!canSubmit) return
    try {
      if (milestone) {
        const patchInput: UpdateMilestoneInput = {
          ...buildInput(),
          // `null` clears a field on update; `undefined` would leave the stored value untouched.
          description: state.description.trim() || null,
          color: isHex(state.color) ? state.color : null
        }
        await update.mutateAsync({ id: milestone.id, patch: patchInput })
      } else {
        await create.mutateAsync(buildInput())
      }
      onOpenChange(false)
    } catch {
      // Already reported by the mutation's onError toast (with Retry); keep the dialog open so the
      // draft can be corrected.
    }
  }

  const confirmRemove = async (): Promise<void> => {
    if (!milestone) return
    try {
      await remove.mutateAsync({ id: milestone.id })
      setConfirmDelete(false)
      onOpenChange(false)
    } catch {
      // Reported by the mutation's onError toast; the confirmation stays open for another attempt.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{milestone ? 'Edit milestone' : 'Create milestone'}</DialogTitle>
          <DialogDescription>
            A milestone is a stretch of your PhD with a start and a target date: coursework,
            research, a publication, an internship. Track work progress against time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="milestone-title">Title</Label>
            <Input
              id="milestone-title"
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Coursework, Quals, First paper"
              autoComplete="off"
              aria-invalid={!titleValid}
            />
            {!titleValid && state.title.length > 0 && (
              <p className="text-xs text-destructive">Title is required.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="milestone-desc">Description (optional)</Label>
            <Textarea
              id="milestone-desc"
              value={state.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="What does done look like?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="milestone-start">Start date</Label>
              <Input
                id="milestone-start"
                type="date"
                value={state.start}
                onChange={(e) => patch({ start: e.target.value })}
                aria-invalid={!startValid}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="milestone-target">Target date</Label>
              <Input
                id="milestone-target"
                type="date"
                value={state.target}
                onChange={(e) => patch({ target: e.target.value })}
                aria-invalid={!targetValid || !orderValid}
              />
            </div>
          </div>
          {startValid && targetValid && !orderValid && (
            <p className="text-xs text-destructive">Target date must be after the start date.</p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <div
              className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
              role="group"
              aria-label="Category"
            >
              {MILESTONE_CATEGORIES.map((id) => {
                const definition = getCategory(id)
                const active = state.category === id
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patch({ category: id })}
                    style={active ? chipStyle(definition.colorToken) : undefined}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'chip-tint border-transparent'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <DynamicIcon name={definition.icon} className="size-3.5 shrink-0" />
                    <span className="truncate">{definition.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <SegmentedControl
              aria-label="Status"
              value={state.status}
              onValueChange={(status) => patch({ status })}
              options={STATUS_OPTIONS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="milestone-progress">Work progress</Label>
              <span className="tabular text-xs text-muted-foreground">{state.progress}%</span>
            </div>
            <Slider
              id="milestone-progress"
              value={[state.progress]}
              onValueChange={(v) => patch({ progress: v[0] ?? 0 })}
              aria-label="Work progress"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Colour (optional)</Label>
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
        </div>

        <DialogFooter className="sm:justify-between">
          <div>
            {milestone && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              <Check aria-hidden="true" />
              {milestone ? 'Save changes' : 'Create milestone'}
            </Button>
          </div>
        </DialogFooter>

        {milestone && (
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{milestone.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  The milestone disappears from every timeline view. Personal deadlines linked to it
                  are kept and only lose the link. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={(event) => {
                    event.preventDefault()
                    void confirmRemove()
                  }}
                >
                  Delete milestone
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  )
}
