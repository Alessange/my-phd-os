import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, Repeat } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { CalendarSource } from '@shared/types/calendar'
import { useNavigation } from '@renderer/app/navigation'
import { CategoryChip } from '@renderer/components/common/CategoryChip'
import { ZonedTime } from '@renderer/components/common/ZonedTime'
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
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@renderer/components/ui/sheet'
import { useFormat } from '@renderer/hooks/useFormat'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'
import { cn, userColor } from '@renderer/lib/utils'
import { useDeleteEvent } from '../api'
import type { Occurrence } from '../lib/occurrences'
import { describeRecurrence } from '../lib/recurrence'

export interface EventDetailsProps {
  occurrence?: Occurrence
  sources: CalendarSource[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (occurrence: Occurrence) => void
}

/** One hairline-separated block of the sheet: an optional 13 px ink-3 caption over the value. */
function Block({ label, children }: { label?: string; children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 border-t border-line py-3 first:border-t-0">
      {label && <div className="text-xs text-ink-3">{label}</div>}
      {children}
    </div>
  )
}

/**
 * Event details sheet (spec 9.2): the title first, when it is, a quiet meta line (category, source,
 * state), then where, notes, link, recurrence in words and links to a personal deadline /
 * conference / milestone, with Edit and Delete right under the content. Source-managed events
 * (conference deadlines from a subscription) cannot be edited here: their instant follows the
 * subscription.
 */
export function EventDetails({
  occurrence,
  sources,
  open,
  onOpenChange,
  onEdit
}: EventDetailsProps): React.JSX.Element | null {
  const format = useFormat()
  const navigate = useNavigation((state) => state.navigate)
  const client = useQueryClient()
  const remove = useDeleteEvent()
  const removeConference = useMutation({
    mutationFn: (id: string) => api('conferences:removeFromCalendar', { id }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.calendar.all })
      void client.invalidateQueries({ queryKey: queryKeys.conferences.all })
    },
    onError: (error, id) => toastError(error, { retry: () => removeConference.mutate(id) })
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (!occurrence) return null
  const { event } = occurrence
  const source = event.sourceCalendarId
    ? sources.find((s) => s.id === event.sourceCalendarId)
    : undefined
  const recurrence = describeRecurrence(event.recurrenceRule)
  const cancelled = event.status === 'cancelled'
  const differentZone =
    !occurrence.allDay &&
    format.formatDateTime(occurrence.startAt) !==
      format.formatDateTime(occurrence.startAt, event.timezone)

  const closeAfter = (): void => {
    setConfirmDelete(false)
    setConfirmRemove(false)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Start on the sheet itself, not on its first control (which would be Delete).
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
      >
        <SheetHeader className="gap-2">
          <SheetTitle className={cn(cancelled && 'text-ink-3 line-through')}>
            {event.title}
          </SheetTitle>
          <SheetDescription className="tabular">
            {format.formatDateRange(occurrence.startAt, occurrence.endAt, {
              allDay: occurrence.allDay
            })}
          </SheetDescription>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            <CategoryChip category={event.category} className="text-ink-3" />
            {source && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: userColor(source.color) }}
                />
                {source.name}
              </span>
            )}
            {event.sourceManaged && (
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3" aria-hidden="true" />
                {event.sourceLabel ?? 'Source-managed'}
              </span>
            )}
            {cancelled && <span className="text-ink-2">Cancelled</span>}
          </p>
        </SheetHeader>
        <SheetBody className="flex flex-col pb-4 text-sm">
          {differentZone && (
            <Block label="In the event’s timezone">
              <ZonedTime
                instantIso={occurrence.startAt}
                originalZone={event.timezone}
                showLocal={false}
                layout="inline"
              />
            </Block>
          )}
          {(recurrence || occurrence.recurring) && (
            <Block>
              <p className="flex items-baseline gap-2 text-ink-2">
                <Repeat className="size-3.5 shrink-0 self-center" aria-hidden="true" />
                <span>
                  {recurrence ?? 'Part of a repeating series'}
                  {occurrence.recurring && (
                    <span className="block text-xs text-ink-3">
                      Edits apply to the whole series.
                    </span>
                  )}
                </span>
              </p>
            </Block>
          )}
          {event.location && (
            <Block label="Location">
              <p>{event.location}</p>
            </Block>
          )}
          {event.description && (
            <Block>
              <p className="whitespace-pre-wrap">{event.description}</p>
            </Block>
          )}
          {event.url && (
            <Block>
              <a href={event.url} target="_blank" rel="noreferrer" className="link truncate">
                {event.url}
              </a>
            </Block>
          )}
          {event.sourceManaged && (
            <Block>
              <p className="flex items-baseline gap-2 text-xs text-ink-2">
                <Lock className="size-3 shrink-0 self-center" aria-hidden="true" />
                <span>
                  Managed by {event.sourceLabel ?? 'its subscription'}: the deadline instant follows
                  the source and cannot be edited here. Create a separate personal event to plan
                  preparation time.
                </span>
              </p>
            </Block>
          )}
          {(event.linkedPersonalDeadlineId ||
            event.linkedConferenceDeadlineId ||
            event.linkedMilestoneId) && (
            <Block>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {event.linkedPersonalDeadlineId && (
                  <button
                    type="button"
                    className="link"
                    onClick={() =>
                      navigate('deadlines', {
                        tab: 'personal',
                        id: event.linkedPersonalDeadlineId ?? ''
                      })
                    }
                  >
                    Open deadline
                  </button>
                )}
                {event.linkedConferenceDeadlineId && (
                  <button
                    type="button"
                    className="link"
                    onClick={() =>
                      navigate('deadlines', {
                        tab: 'conference',
                        id: event.linkedConferenceDeadlineId ?? ''
                      })
                    }
                  >
                    Open conference
                  </button>
                )}
                {event.linkedMilestoneId && (
                  <button
                    type="button"
                    className="link"
                    onClick={() =>
                      navigate('timeline', { milestoneId: event.linkedMilestoneId ?? '' })
                    }
                  >
                    Open milestone
                  </button>
                )}
              </div>
            </Block>
          )}
        </SheetBody>
        <SheetFooter className="sm:justify-between">
          {event.sourceManaged && event.linkedConferenceDeadlineId ? (
            <Button
              variant="destructive"
              disabled={removeConference.isPending}
              onClick={() => setConfirmRemove(true)}
            >
              Remove from calendar
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          {!event.sourceManaged && <Button onClick={() => onEdit(occurrence)}>Edit</Button>}
        </SheetFooter>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{event.title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {event.recurrenceRule || occurrence.recurring
                  ? 'The whole series is removed. This cannot be undone.'
                  : 'The event is removed from this computer. This cannot be undone.'}
                {event.linkedPersonalDeadlineId
                  ? ' The linked personal deadline is kept and only loses its link.'
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={remove.isPending}
                onClick={(e) => {
                  e.preventDefault()
                  remove.mutate({ id: event.id }, { onSuccess: closeAfter })
                }}
              >
                Delete event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove “{event.title}” from your calendar?</AlertDialogTitle>
              <AlertDialogDescription>
                Only its calendar entry goes; the conference stays on the Deadlines page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={removeConference.isPending}
                onClick={(e) => {
                  e.preventDefault()
                  removeConference.mutate(event.linkedConferenceDeadlineId ?? '', {
                    onSuccess: closeAfter
                  })
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
