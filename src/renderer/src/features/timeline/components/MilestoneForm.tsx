import { CircleAlert } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { AddRow, PropertyRow } from '@renderer/components/ui/property-row'
import { Slider } from '@renderer/components/ui/slider'
import { Textarea } from '@renderer/components/ui/textarea'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { useCreateMilestone, useDeleteMilestone, useUpdateMilestone } from '../api'

/** Default span of a new milestone: about a semester. */
const DEFAULT_SPAN_DAYS = 183

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
}

const emptyFor = (today: string): FormState => ({
  title: '',
  description: '',
  start: today,
  target: addDays(today, DEFAULT_SPAN_DAYS),
  category: 'research',
  status: 'not_started',
  progress: 0
})

const fromMilestone = (m: Milestone, zone: ZoneInput): FormState => ({
  title: m.title,
  description: m.description ?? '',
  start: dateKeyInZone(m.startAt, zone),
  target: dateKeyInZone(m.targetAt, zone),
  category: m.category,
  status: m.status,
  progress: m.progress
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
  // Validation is shown after the first blur, never on a pristine field.
  const [touchedTitle, setTouchedTitle] = useState(false)
  const [descriptionShown, setDescriptionShown] = useState(false)
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
      setTouchedTitle(false)
      setDescriptionShown(false)
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
    progress: state.progress
  })

  const submit = async (): Promise<void> => {
    if (!canSubmit) return
    try {
      if (milestone) {
        const patchInput: UpdateMilestoneInput = {
          ...buildInput(),
          // `null` clears a field on update; `undefined` would leave the stored value untouched. The
          // stored colour is never sent: the form has no colour control and must not overwrite it.
          description: state.description.trim() || null
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

  const showErrors = touchedTitle && !titleValid
  const datesInvalid = !startValid || !targetValid
  const descriptionOpen = descriptionShown || state.description.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{milestone ? 'Edit milestone' : 'Create milestone'}</DialogTitle>
          <DialogDescription className="sr-only">
            A milestone is a stretch of your PhD with a start and a target date. Work progress is
            tracked against time.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-8"
          onSubmit={(event) => {
            event.preventDefault()
            setTouchedTitle(true)
            void submit()
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="milestone-title">Title</Label>
            <Input
              id="milestone-title"
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              onBlur={() => setTouchedTitle(true)}
              placeholder="e.g. Qualifying exam"
              autoComplete="off"
              aria-invalid={showErrors || undefined}
              aria-describedby={showErrors ? 'milestone-title-error' : undefined}
            />
            {showErrors && <FieldError id="milestone-title-error">Title is required.</FieldError>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-8">
              <div className="flex flex-col gap-1">
                <Label htmlFor="milestone-start">Start date</Label>
                <Input
                  id="milestone-start"
                  type="date"
                  value={state.start}
                  onChange={(e) => patch({ start: e.target.value })}
                  aria-invalid={!startValid || undefined}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="milestone-target">Target date</Label>
                <Input
                  id="milestone-target"
                  type="date"
                  value={state.target}
                  onChange={(e) => patch({ target: e.target.value })}
                  aria-invalid={!targetValid || (startValid && !orderValid) || undefined}
                />
              </div>
            </div>
            {datesInvalid && <FieldError>Enter a start date and a target date.</FieldError>}
            {!datesInvalid && !orderValid && (
              <FieldError>Target date must be after the start date.</FieldError>
            )}
          </div>

          <div className="-mt-2 flex flex-col">
            <PropertyRow label="Category" htmlFor="milestone-category">
              <Select
                value={state.category}
                onValueChange={(category) => patch({ category: category as MilestoneCategory })}
              >
                <SelectTrigger
                  id="milestone-category"
                  variant="bare"
                  aria-label="Category"
                  className="w-auto"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_CATEGORIES.map((id) => (
                    <SelectItem key={id} value={id}>
                      {getCategory(id).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>
            <PropertyRow label="Status" htmlFor="milestone-status">
              <Select
                value={state.status}
                onValueChange={(status) => patch({ status: status as MilestoneStatus })}
              >
                <SelectTrigger
                  id="milestone-status"
                  variant="bare"
                  aria-label="Status"
                  className="w-auto"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>
            <PropertyRow label="Progress" htmlFor="milestone-progress">
              <div className="flex w-56 items-center gap-4">
                <Slider
                  id="milestone-progress"
                  value={[state.progress]}
                  onValueChange={(v) => patch({ progress: v[0] ?? 0 })}
                  aria-label="Work progress"
                />
                <span className="tabular w-10 shrink-0 text-right text-body text-ink-2">
                  {state.progress}%
                </span>
              </div>
            </PropertyRow>
            {descriptionOpen ? (
              <div className="flex flex-col gap-1 border-b border-line py-3">
                <Label htmlFor="milestone-desc">Description</Label>
                <Textarea
                  id="milestone-desc"
                  value={state.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="What does done look like?"
                  rows={2}
                  autoFocus={descriptionShown}
                />
              </div>
            ) : (
              <AddRow onClick={() => setDescriptionShown(true)}>Add description</AddRow>
            )}
          </div>

          <DialogFooter className="justify-between">
            <div>
              {milestone && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {milestone ? 'Save changes' : 'Create milestone'}
              </Button>
            </div>
          </DialogFooter>
        </form>

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

/** A signal glyph and 13 px message under a field; the field's own rule turns signal via `aria-invalid`. */
function FieldError({
  id,
  children
}: {
  id?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-meta text-signal">
      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </p>
  )
}
