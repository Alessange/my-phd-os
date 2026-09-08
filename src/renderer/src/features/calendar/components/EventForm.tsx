import { Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { getCategory } from '@shared/constants/categories'
import { TIMEZONE_OPTIONS } from '@shared/constants/timezones'
import {
  addDays,
  compareDateKeys,
  compareInstants,
  instantToWallTime,
  isAllDayDate,
  isValidZoneInput,
  resolveZone,
  wallTimeToInstant
} from '@shared/dates'
import type { CreateCalendarEventInput, UpdateCalendarEventInput } from '@shared/schemas/calendar'
import {
  CALENDAR_EVENT_CATEGORIES,
  type CalendarEvent,
  type CalendarEventCategory
} from '@shared/types/calendar'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { Textarea } from '@renderer/components/ui/textarea'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { chipStyle, cn } from '@renderer/lib/utils'
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from '../api'
import { defaultEventTimes } from '../lib/eventDefaults'
import {
  RECURRENCE_PRESETS,
  RECURRENCE_PRESET_LABELS,
  buildRecurrenceRule,
  recurrenceDraftFromRule,
  validateRecurrenceRule,
  type RecurrenceDraft,
  type RecurrencePreset
} from '../lib/recurrence'

const TIME_PATTERN = /^\d{2}:\d{2}$/
const ZONE_GROUPS = TIMEZONE_OPTIONS.map((group) => ({
  ...group,
  options: group.options.filter((option) => option.id !== 'system')
}))
const KNOWN_ZONE_IDS = new Set(ZONE_GROUPS.flatMap((g) => g.options.map((o) => o.id)))

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Stored per-event zone: the app zone, with `system` resolved to a concrete IANA name. */
const defaultZone = (settingsTimezone: string): string =>
  settingsTimezone === 'system' ? (resolveZone('system').ianaName ?? 'UTC') : settingsTimezone

const toInstant = (date: string, time: string, zone: string): string | undefined => {
  if (!isAllDayDate(date) || !TIME_PATTERN.test(time) || !isValidZoneInput(zone)) return undefined
  try {
    return wallTimeToInstant(`${date}T${time}:00`, zone)
  } catch {
    return undefined
  }
}

interface FormState {
  title: string
  allDay: boolean
  startDate: string
  startTime: string
  /** Inclusive end date for all-day events (stored as the exclusive next day). */
  endDate: string
  endTime: string
  timezone: string
  category: CalendarEventCategory
  location: string
  description: string
  url: string
  recurrence: RecurrenceDraft
}

/** A slot the user selected on the grid (instants, or date keys for all-day). */
export interface EventFormInitial {
  startAt: string
  endAt: string
  allDay: boolean
}

const emptyState = (nowIso: string, zone: string, initial?: EventFormInitial): FormState => {
  if (initial) {
    if (initial.allDay) {
      return {
        ...base(zone),
        allDay: true,
        startDate: initial.startAt.slice(0, 10),
        endDate: addDays(initial.endAt.slice(0, 10), -1),
        startTime: '09:00',
        endTime: '10:00'
      }
    }
    const start = instantToWallTime(initial.startAt, zone)
    const end = instantToWallTime(initial.endAt, zone)
    return {
      ...base(zone),
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time
    }
  }
  const next = defaultEventTimes(nowIso, zone)
  return {
    ...base(zone),
    startDate: next.startDate,
    startTime: next.startTime,
    endDate: next.endDate,
    endTime: next.endTime
  }
}

const base = (zone: string): FormState => ({
  title: '',
  allDay: false,
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '10:00',
  timezone: zone,
  category: 'meeting',
  location: '',
  description: '',
  url: '',
  recurrence: { preset: 'none', end: { kind: 'never' }, custom: '' }
})

const fromEvent = (event: CalendarEvent): FormState => {
  const zone = event.timezone
  const start = event.allDay ? undefined : instantToWallTime(event.startAt, zone)
  const end = event.allDay ? undefined : instantToWallTime(event.endAt, zone)
  const startDate = event.allDay ? event.startAt : (start?.date ?? event.startAt.slice(0, 10))
  return {
    title: event.title,
    allDay: event.allDay,
    startDate,
    startTime: start?.time ?? '09:00',
    endDate: event.allDay ? addDays(event.endAt, -1) : (end?.date ?? startDate),
    endTime: end?.time ?? '10:00',
    timezone: zone,
    category: event.category,
    location: event.location ?? '',
    description: event.description ?? '',
    url: event.url ?? '',
    recurrence: recurrenceDraftFromRule(event.recurrenceRule, startDate)
  }
}

export interface EventFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the form edits (and can delete) this event; otherwise it creates a new one. */
  event?: CalendarEvent
  /** Prefilled slot for a new event (clicking / selecting on the grid). */
  initial?: EventFormInitial
}

/**
 * Create or edit a calendar event (spec §9.2): title, all-day switch, start and end, per-event
 * timezone (app zone by default), category, location, description, link, and a small recurrence
 * model (presets or a raw RRULE). Source-managed events never reach this form. Deleting confirms.
 */
export function EventForm({
  open,
  onOpenChange,
  event,
  initial
}: EventFormProps): React.JSX.Element {
  const format = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const zoneDefault = defaultZone(format.settings.timezone)
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const remove = useDeleteEvent()

  const [state, setState] = useState<FormState>(() => emptyState(nowIso, zoneDefault, initial))
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Reset when the dialog opens or its target changes (derived during render, see HabitForm).
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevTarget, setPrevTarget] = useState<{
    event?: CalendarEvent
    initial?: EventFormInitial
  }>({ event, initial })
  if (open !== prevOpen || event !== prevTarget.event || initial !== prevTarget.initial) {
    setPrevOpen(open)
    setPrevTarget({ event, initial })
    if (open) {
      setState(event ? fromEvent(event) : emptyState(nowIso, zoneDefault, initial))
      setConfirmDelete(false)
    }
  }
  const patch = (p: Partial<FormState>): void => setState((s) => ({ ...s, ...p }))
  const patchRecurrence = (p: Partial<RecurrenceDraft>): void =>
    setState((s) => ({ ...s, recurrence: { ...s.recurrence, ...p } }))

  const startAt = state.allDay
    ? isAllDayDate(state.startDate)
      ? state.startDate
      : undefined
    : toInstant(state.startDate, state.startTime, state.timezone)
  const endAt = state.allDay
    ? isAllDayDate(state.endDate)
      ? addDays(state.endDate, 1)
      : undefined
    : toInstant(state.endDate, state.endTime, state.timezone)
  const titleValid = state.title.trim().length > 0
  const zoneValid = isValidZoneInput(state.timezone)
  const orderValid =
    startAt !== undefined &&
    endAt !== undefined &&
    (state.allDay ? compareDateKeys(startAt, endAt) < 0 : compareInstants(startAt, endAt) <= 0)
  const urlValid = state.url.trim() === '' || isHttpUrl(state.url.trim())
  const ruleError =
    state.recurrence.preset === 'custom'
      ? validateRecurrenceRule(state.recurrence.custom)
      : undefined
  const busy = create.isPending || update.isPending || remove.isPending
  const canSubmit =
    titleValid && zoneValid && orderValid && urlValid && ruleError === undefined && !busy

  const recurrenceRule = buildRecurrenceRule(state.recurrence, state.startDate)

  const buildCreate = (): CreateCalendarEventInput => ({
    title: state.title.trim(),
    description: state.description.trim() || undefined,
    startAt: startAt ?? '',
    endAt: endAt ?? '',
    timezone: state.timezone,
    allDay: state.allDay,
    category: state.category,
    location: state.location.trim() || undefined,
    url: state.url.trim() || undefined,
    recurrenceRule,
    sourceManaged: false
  })
  // On update, `null` clears an optional field; `undefined` would leave the stored value untouched.
  const buildPatch = (): UpdateCalendarEventInput => ({
    ...buildCreate(),
    description: state.description.trim() || null,
    location: state.location.trim() || null,
    url: state.url.trim() || null,
    recurrenceRule: recurrenceRule ?? null
  })

  const submit = async (): Promise<void> => {
    if (!canSubmit) return
    try {
      if (event) await update.mutateAsync({ id: event.id, patch: buildPatch() })
      else await create.mutateAsync(buildCreate())
      onOpenChange(false)
    } catch {
      // Already reported by the mutation's onError toast (with Retry); keep the dialog open.
    }
  }

  const confirmRemove = async (): Promise<void> => {
    if (!event) return
    try {
      await remove.mutateAsync({ id: event.id })
      setConfirmDelete(false)
      onOpenChange(false)
    } catch {
      // Reported by the mutation's onError toast; the confirmation stays open for another attempt.
    }
  }

  const zoneKnown = KNOWN_ZONE_IDS.has(state.timezone)
  const preview =
    startAt && endAt && zoneValid
      ? state.allDay
        ? format.formatDateRange(startAt, endAt, { allDay: true })
        : `${format.formatDateTimeWithZone(startAt, state.timezone)} → ${format.formatDateTimeWithZone(endAt, state.timezone)}`
      : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit event' : 'Create event'}</DialogTitle>
          <DialogDescription>
            {event?.recurrenceRule
              ? 'This event repeats. Changes apply to the whole series.'
              : 'Times are interpreted in the event’s timezone and shown in yours.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Supervisor meeting"
              autoComplete="off"
              aria-invalid={!titleValid}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="event-all-day">All-day</Label>
            <Switch
              id="event-all-day"
              checked={state.allDay}
              onCheckedChange={(allDay) => patch({ allDay })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-start-date">{state.allDay ? 'First day' : 'Start date'}</Label>
              <Input
                id="event-start-date"
                type="date"
                value={state.startDate}
                onChange={(e) =>
                  patch({
                    startDate: e.target.value,
                    endDate: state.endDate < e.target.value ? e.target.value : state.endDate
                  })
                }
                aria-invalid={!isAllDayDate(state.startDate)}
              />
            </div>
            {!state.allDay && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-start-time">Start time</Label>
                <Input
                  id="event-start-time"
                  type="time"
                  value={state.startTime}
                  onChange={(e) => patch({ startTime: e.target.value })}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-end-date">{state.allDay ? 'Last day' : 'End date'}</Label>
              <Input
                id="event-end-date"
                type="date"
                value={state.endDate}
                onChange={(e) => patch({ endDate: e.target.value })}
                aria-invalid={!isAllDayDate(state.endDate) || !orderValid}
              />
            </div>
            {!state.allDay && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-end-time">End time</Label>
                <Input
                  id="event-end-time"
                  type="time"
                  value={state.endTime}
                  onChange={(e) => patch({ endTime: e.target.value })}
                  aria-invalid={!orderValid}
                />
              </div>
            )}
          </div>
          {startAt && endAt && !orderValid && (
            <p className="text-xs text-destructive">The end must not be before the start.</p>
          )}

          {!state.allDay && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-timezone">Timezone</Label>
              <Select value={state.timezone} onValueChange={(timezone) => patch({ timezone })}>
                <SelectTrigger id="event-timezone" className="w-full" aria-label="Timezone">
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
            </div>
          )}
          {preview && (
            <p className="tabular text-xs text-muted-foreground" data-testid="event-preview">
              {preview}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <div
              className="grid grid-cols-3 gap-1.5 sm:grid-cols-5"
              role="group"
              aria-label="Category"
            >
              {CALENDAR_EVENT_CATEGORIES.map((id) => {
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
              <Label htmlFor="event-recurrence">Repeat</Label>
              <Select
                value={state.recurrence.preset}
                onValueChange={(preset) => patchRecurrence({ preset: preset as RecurrencePreset })}
              >
                <SelectTrigger id="event-recurrence" className="w-full" aria-label="Repeat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {RECURRENCE_PRESET_LABELS[preset]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {state.recurrence.preset !== 'none' && state.recurrence.preset !== 'custom' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-recurrence-end">Ends</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={state.recurrence.end.kind}
                    onValueChange={(kind) =>
                      patchRecurrence({
                        end:
                          kind === 'until'
                            ? { kind: 'until', date: addDays(state.startDate || '2026-01-01', 90) }
                            : kind === 'count'
                              ? { kind: 'count', count: 10 }
                              : { kind: 'never' }
                      })
                    }
                  >
                    <SelectTrigger
                      id="event-recurrence-end"
                      className="w-36"
                      aria-label="Repeat ends"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="until">On date</SelectItem>
                      <SelectItem value="count">After count</SelectItem>
                    </SelectContent>
                  </Select>
                  {state.recurrence.end.kind === 'until' && (
                    <Input
                      type="date"
                      aria-label="Repeat until"
                      value={state.recurrence.end.date}
                      onChange={(e) =>
                        patchRecurrence({ end: { kind: 'until', date: e.target.value } })
                      }
                    />
                  )}
                  {state.recurrence.end.kind === 'count' && (
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      aria-label="Number of occurrences"
                      className="w-20"
                      value={state.recurrence.end.count}
                      onChange={(e) =>
                        patchRecurrence({
                          end: { kind: 'count', count: Number(e.target.value) || 1 }
                        })
                      }
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          {state.recurrence.preset === 'custom' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-rrule">RRULE</Label>
              <Input
                id="event-rrule"
                value={state.recurrence.custom}
                onChange={(e) => patchRecurrence({ custom: e.target.value })}
                placeholder="FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10"
                className="font-mono"
                aria-invalid={ruleError !== undefined}
              />
              {ruleError && <p className="text-xs text-destructive">{ruleError}</p>}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-location">Location (optional)</Label>
              <Input
                id="event-location"
                value={state.location}
                onChange={(e) => patch({ location: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-url">Link (optional)</Label>
              <Input
                id="event-url"
                type="url"
                inputMode="url"
                value={state.url}
                onChange={(e) => patch({ url: e.target.value })}
                placeholder="https://"
                aria-invalid={!urlValid}
              />
              {!urlValid && <p className="text-xs text-destructive">Enter an http(s) link.</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-description">Description (optional)</Label>
            <Textarea
              id="event-description"
              value={state.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <div>
            {event && (
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
              {event ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </DialogFooter>

        {event && (
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{event.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  {event.recurrenceRule
                    ? 'The whole series and any modified occurrences are removed. This cannot be undone.'
                    : 'The event is removed from this computer. This cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    void confirmRemove()
                  }}
                >
                  Delete event
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  )
}
