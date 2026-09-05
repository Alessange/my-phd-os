import { Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { getCategory } from '@shared/constants/categories'
import {
  PERSONAL_DEADLINE_STATUS_DEFINITIONS,
  PRIORITY_DEFINITIONS
} from '@shared/constants/statuses'
import { TIMEZONE_OPTIONS } from '@shared/constants/timezones'
import {
  addDays,
  compareInstants,
  instantToWallTime,
  isAllDayDate,
  isValidZoneInput,
  resolveZone,
  wallTimeToInstant
} from '@shared/dates'
import {
  DEADLINE_WINDOW_MESSAGE,
  type CreatePersonalDeadlineInput,
  type UpdatePersonalDeadlineInput
} from '@shared/schemas/personalDeadline'
import {
  PERSONAL_DEADLINE_CATEGORIES,
  type PersonalDeadline,
  type PersonalDeadlineCategory,
  type PersonalDeadlineStatus,
  type Priority
} from '@shared/types/personalDeadline'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Slider } from '@renderer/components/ui/slider'
import { Textarea } from '@renderer/components/ui/textarea'
import { useMilestones } from '@renderer/features/timeline/api'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { chipStyle, cn } from '@renderer/lib/utils'
import {
  useCreatePersonalDeadline,
  useDeletePersonalDeadline,
  useUpdatePersonalDeadline
} from '../api'

const TIME_PATTERN = /^\d{2}:\d{2}$/
const NONE = 'none'
/** Default deadline for a new entry: two weeks out, end of day. */
const DEFAULT_LEAD_DAYS = 14

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Wall clock (date + HH:mm) in `zone` → canonical instant; undefined while the input is incomplete or invalid. */
const toInstant = (date: string, time: string, zone: string): string | undefined => {
  if (!isAllDayDate(date) || !TIME_PATTERN.test(time) || !isValidZoneInput(zone)) return undefined
  try {
    return wallTimeToInstant(`${date}T${time}:00`, zone)
  } catch {
    return undefined
  }
}

const parseTags = (raw: string): string[] => [
  ...new Set(
    raw
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  )
]

/** Stored per-deadline zone: the app zone, with `system` resolved to a concrete IANA name. */
const defaultDeadlineZone = (settingsTimezone: string): string =>
  settingsTimezone === 'system' ? (resolveZone('system').ianaName ?? 'UTC') : settingsTimezone

const ZONE_GROUPS = TIMEZONE_OPTIONS.map((group) => ({
  ...group,
  options: group.options.filter((option) => option.id !== 'system')
}))
const KNOWN_ZONE_IDS = new Set(ZONE_GROUPS.flatMap((g) => g.options.map((o) => o.id)))

const PRIORITY_OPTIONS = Object.values(PRIORITY_DEFINITIONS).map((def) => ({
  value: def.id,
  label: def.label
}))
const STATUS_OPTIONS = Object.values(PERSONAL_DEADLINE_STATUS_DEFINITIONS).map((def) => ({
  value: def.id,
  label: def.label
}))

interface FormState {
  title: string
  description: string
  trackingDate: string
  trackingTime: string
  deadlineDate: string
  deadlineTime: string
  timezone: string
  category: PersonalDeadlineCategory
  priority: Priority
  status: PersonalDeadlineStatus
  progress: number
  sourceUrl: string
  location: string
  tags: string
  /** Milestone id or `NONE`. */
  linkedMilestoneId: string
}

const emptyFor = (nowIso: string, zone: string): FormState => {
  const now = instantToWallTime(nowIso, zone)
  return {
    title: '',
    description: '',
    trackingDate: now.date,
    trackingTime: now.time,
    deadlineDate: addDays(now.date, DEFAULT_LEAD_DAYS),
    deadlineTime: '23:59',
    timezone: zone,
    category: 'paper',
    priority: 'medium',
    status: 'not_started',
    progress: 0,
    sourceUrl: '',
    location: '',
    tags: '',
    linkedMilestoneId: NONE
  }
}

const fromDeadline = (d: PersonalDeadline): FormState => {
  const start = instantToWallTime(d.trackingStartAt, d.timezone)
  const end = instantToWallTime(d.deadlineAt, d.timezone)
  return {
    title: d.title,
    description: d.description ?? '',
    trackingDate: start.date,
    trackingTime: start.time,
    deadlineDate: end.date,
    deadlineTime: end.time,
    timezone: d.timezone,
    category: d.category,
    priority: d.priority,
    status: d.status,
    progress: d.progress,
    sourceUrl: d.sourceUrl ?? '',
    location: d.location ?? '',
    tags: (d.tags ?? []).join(', '),
    linkedMilestoneId: d.linkedMilestoneId ?? NONE
  }
}

export interface PersonalDeadlineFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the form edits (and can delete) this deadline; otherwise it creates a new one. */
  deadline?: PersonalDeadline
}

/**
 * Create or edit a personal deadline (spec §13.1). Times are entered as wall clock in the
 * deadline's own timezone (app zone by default; IANA names, UTC offsets, AoE and PT accepted) and
 * stored as canonical instants plus the zone. Validation mirrors the Zod schema and the tracking
 * window rule; the mutation hooks surface failures as toasts with Retry. Deleting confirms first.
 */
export function PersonalDeadlineForm({
  open,
  onOpenChange,
  deadline
}: PersonalDeadlineFormProps): React.JSX.Element {
  const format = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const zoneDefault = defaultDeadlineZone(format.settings.timezone)
  const milestones = useMilestones()
  const create = useCreatePersonalDeadline()
  const update = useUpdatePersonalDeadline()
  const remove = useDeletePersonalDeadline()

  const [state, setState] = useState<FormState>(() => emptyFor(nowIso, zoneDefault))
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Reset when the dialog opens or switches target (derived during render; see HabitForm).
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevDeadline, setPrevDeadline] = useState(deadline)
  if (open !== prevOpen || deadline !== prevDeadline) {
    setPrevOpen(open)
    setPrevDeadline(deadline)
    if (open) {
      setState(deadline ? fromDeadline(deadline) : emptyFor(nowIso, zoneDefault))
      setConfirmDelete(false)
    }
  }

  const patch = (p: Partial<FormState>): void => setState((s) => ({ ...s, ...p }))

  const trackingStartAt = toInstant(state.trackingDate, state.trackingTime, state.timezone)
  const deadlineAt = toInstant(state.deadlineDate, state.deadlineTime, state.timezone)
  const titleValid = state.title.trim().length > 0
  const zoneValid = isValidZoneInput(state.timezone)
  const windowValid =
    trackingStartAt !== undefined &&
    deadlineAt !== undefined &&
    compareInstants(trackingStartAt, deadlineAt) <= 0
  const urlValid = state.sourceUrl.trim() === '' || isHttpUrl(state.sourceUrl.trim())
  const busy = create.isPending || update.isPending || remove.isPending
  const canSubmit =
    titleValid &&
    zoneValid &&
    trackingStartAt !== undefined &&
    deadlineAt !== undefined &&
    windowValid &&
    urlValid &&
    !busy

  const buildCreate = (): CreatePersonalDeadlineInput => {
    const tags = parseTags(state.tags)
    return {
      title: state.title.trim(),
      description: state.description.trim() || undefined,
      trackingStartAt: trackingStartAt ?? '',
      deadlineAt: deadlineAt ?? '',
      timezone: state.timezone,
      category: state.category,
      priority: state.priority,
      status: state.status,
      progress: state.progress,
      sourceUrl: state.sourceUrl.trim() || undefined,
      location: state.location.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      linkedMilestoneId: state.linkedMilestoneId === NONE ? undefined : state.linkedMilestoneId
    }
  }

  // On update, `null` clears an optional field; `undefined` would leave the stored value untouched.
  const buildPatch = (): UpdatePersonalDeadlineInput => ({
    ...buildCreate(),
    description: state.description.trim() || null,
    sourceUrl: state.sourceUrl.trim() || null,
    location: state.location.trim() || null,
    tags: parseTags(state.tags),
    linkedMilestoneId: state.linkedMilestoneId === NONE ? null : state.linkedMilestoneId
  })

  const submit = async (): Promise<void> => {
    if (!canSubmit) return
    try {
      if (deadline) await update.mutateAsync({ id: deadline.id, patch: buildPatch() })
      else await create.mutateAsync(buildCreate())
      onOpenChange(false)
    } catch {
      // Already reported by the mutation's onError toast (with Retry); keep the dialog open so the
      // draft can be corrected.
    }
  }

  const confirmRemove = async (): Promise<void> => {
    if (!deadline) return
    try {
      await remove.mutateAsync({ id: deadline.id })
      setConfirmDelete(false)
      onOpenChange(false)
    } catch {
      // Reported by the mutation's onError toast; the confirmation stays open for another attempt.
    }
  }

  const zoneKnown = KNOWN_ZONE_IDS.has(state.timezone)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deadline ? 'Edit personal deadline' : 'Add personal deadline'}</DialogTitle>
          <DialogDescription>
            Track the time left and your own progress toward a deadline. Times are interpreted in
            the deadline’s timezone and shown in yours.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deadline-title">Title</Label>
            <Input
              id="deadline-title"
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. NeurIPS camera-ready, Scholarship application"
              autoComplete="off"
              aria-invalid={!titleValid}
            />
            {!titleValid && state.title.length > 0 && (
              <p className="text-xs text-destructive">Title is required.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline-date">Deadline date</Label>
              <Input
                id="deadline-date"
                type="date"
                value={state.deadlineDate}
                onChange={(e) => patch({ deadlineDate: e.target.value })}
                aria-invalid={!isAllDayDate(state.deadlineDate)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline-time">Exact deadline time</Label>
              <Input
                id="deadline-time"
                type="time"
                value={state.deadlineTime}
                onChange={(e) => patch({ deadlineTime: e.target.value })}
                aria-invalid={!TIME_PATTERN.test(state.deadlineTime)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deadline-timezone">Timezone</Label>
            <Select value={state.timezone} onValueChange={(timezone) => patch({ timezone })}>
              <SelectTrigger id="deadline-timezone" className="w-full" aria-label="Timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!zoneKnown && (
                  <SelectGroup>
                    <SelectLabel>Current</SelectLabel>
                    <SelectItem value={state.timezone}>{state.timezone}</SelectItem>
                  </SelectGroup>
                )}
                {ZONE_GROUPS.map((group) => (
                  <SelectGroup key={group.group}>
                    <SelectLabel>{group.group}</SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {deadlineAt && zoneValid && (
              <p className="tabular text-xs text-muted-foreground" data-testid="deadline-preview">
                {format.formatDateTimeWithZone(deadlineAt, state.timezone)} · Local:{' '}
                {format.formatDateTimeWithZone(deadlineAt)}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tracking-date">Tracking start date</Label>
              <Input
                id="tracking-date"
                type="date"
                value={state.trackingDate}
                onChange={(e) => patch({ trackingDate: e.target.value })}
                aria-invalid={!isAllDayDate(state.trackingDate) || !windowValid}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tracking-time">Tracking start time</Label>
              <Input
                id="tracking-time"
                type="time"
                value={state.trackingTime}
                onChange={(e) => patch({ trackingTime: e.target.value })}
                aria-invalid={!TIME_PATTERN.test(state.trackingTime)}
              />
            </div>
          </div>
          {trackingStartAt && deadlineAt && !windowValid && (
            <p className="text-xs text-destructive">{DEADLINE_WINDOW_MESSAGE}.</p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <div
              className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
              role="group"
              aria-label="Category"
            >
              {PERSONAL_DEADLINE_CATEGORIES.map((id) => {
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <SegmentedControl
                aria-label="Priority"
                size="sm"
                value={state.priority}
                onValueChange={(priority) => patch({ priority })}
                options={PRIORITY_OPTIONS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <SegmentedControl
                aria-label="Status"
                size="sm"
                value={state.status}
                onValueChange={(status) => patch({ status })}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="deadline-progress">Current progress</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="deadline-progress"
                  type="number"
                  min={0}
                  max={100}
                  value={state.progress}
                  onChange={(e) =>
                    patch({ progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                  }
                  className="tabular w-20"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={[state.progress]}
              onValueChange={(v) => patch({ progress: v[0] ?? 0 })}
              aria-label="Current progress"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deadline-desc">Description (optional)</Label>
            <Textarea
              id="deadline-desc"
              value={state.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline-url">Source URL (optional)</Label>
              <Input
                id="deadline-url"
                type="url"
                inputMode="url"
                value={state.sourceUrl}
                onChange={(e) => patch({ sourceUrl: e.target.value })}
                placeholder="https://"
                aria-invalid={!urlValid}
              />
              {!urlValid && <p className="text-xs text-destructive">Enter an http(s) link.</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline-location">Location (optional)</Label>
              <Input
                id="deadline-location"
                value={state.location}
                onChange={(e) => patch({ location: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline-tags">Tags (optional)</Label>
              <Input
                id="deadline-tags"
                value={state.tags}
                onChange={(e) => patch({ tags: e.target.value })}
                placeholder="thesis, grant"
              />
              <p className="text-[11px] text-muted-foreground">Separate tags with commas.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline-milestone">Linked milestone (optional)</Label>
              <Select
                value={state.linkedMilestoneId}
                onValueChange={(linkedMilestoneId) => patch({ linkedMilestoneId })}
              >
                <SelectTrigger
                  id="deadline-milestone"
                  className="w-full"
                  aria-label="Linked milestone"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No milestone</SelectItem>
                  {(milestones.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <div>
            {deadline && (
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
              {deadline ? 'Save changes' : 'Create deadline'}
            </Button>
          </div>
        </DialogFooter>

        {deadline && (
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{deadline.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  The deadline and its progress history are removed from this computer
                  {deadline.linkedCalendarEventId
                    ? ', together with its linked calendar event'
                    : ''}
                  . This cannot be undone.
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
                  Delete deadline
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  )
}
