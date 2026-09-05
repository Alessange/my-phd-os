import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarX,
  ExternalLink,
  Link2,
  Lock,
  Pencil,
  Repeat,
  Route,
  Timer,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
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
import { Badge } from '@renderer/components/ui/badge'
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

/**
 * Event details drawer (spec §9.2): when, where, category, source, recurrence in words, links to a
 * personal deadline / conference / milestone, and Edit / Delete. Source-managed events (conference
 * deadlines from a subscription) cannot be edited here: their instant follows the subscription.
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

  if (!occurrence) return null
  const { event } = occurrence
  const source = event.sourceCalendarId
    ? sources.find((s) => s.id === event.sourceCalendarId)
    : undefined
  const recurrence = describeRecurrence(event.recurrenceRule)
  const differentZone =
    !occurrence.allDay &&
    format.formatDateTime(occurrence.startAt) !==
      format.formatDateTime(occurrence.startAt, event.timezone)

  const closeAfter = (): void => {
    setConfirmDelete(false)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryChip category={event.category} marker="icon" tinted />
            {source && (
              <Badge variant="outline" className="gap-1">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: source.color }}
                />
                {source.name}
              </Badge>
            )}
            {event.sourceManaged && (
              <Badge variant="outline" className="gap-1">
                <Lock className="size-3" aria-hidden="true" />
                {event.sourceLabel ?? 'Source-managed'}
              </Badge>
            )}
            {event.status === 'cancelled' && <Badge variant="destructive">Cancelled</Badge>}
          </div>
          <SheetTitle className={event.status === 'cancelled' ? 'line-through' : undefined}>
            {event.title}
          </SheetTitle>
          <SheetDescription className="tabular">
            {format.formatDateRange(occurrence.startAt, occurrence.endAt, {
              allDay: occurrence.allDay
            })}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-4 text-sm">
          {differentZone && (
            <div>
              <div className="text-xs text-muted-foreground">In the event’s timezone</div>
              <ZonedTime
                instantIso={occurrence.startAt}
                originalZone={event.timezone}
                showLocal={false}
                layout="inline"
              />
            </div>
          )}
          {(recurrence || occurrence.recurring) && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Repeat className="size-3.5" aria-hidden="true" />
              {recurrence ?? 'Part of a repeating series'}
              {occurrence.recurring && (
                <span className="text-xs">· edits apply to the whole series</span>
              )}
            </p>
          )}
          {event.location && (
            <p>
              <span className="text-muted-foreground">Location: </span>
              {event.location}
            </p>
          )}
          {event.description && <p className="whitespace-pre-wrap">{event.description}</p>}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="truncate">{event.url}</span>
            </a>
          )}
          {event.sourceManaged && (
            <p className="rounded-md border border-status-tbd/40 bg-status-tbd/8 px-3 py-2 text-xs text-muted-foreground">
              Managed by {event.sourceLabel ?? 'its subscription'}: the deadline instant follows the
              source and cannot be edited here. Create a separate personal event to plan preparation
              time.
            </p>
          )}
          {(event.linkedPersonalDeadlineId ||
            event.linkedConferenceDeadlineId ||
            event.linkedMilestoneId) && (
            <div className="flex flex-wrap gap-1.5">
              {event.linkedPersonalDeadlineId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate('deadlines', {
                      tab: 'personal',
                      id: event.linkedPersonalDeadlineId ?? ''
                    })
                  }
                >
                  <Timer aria-hidden="true" />
                  Open deadline
                </Button>
              )}
              {event.linkedConferenceDeadlineId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate('deadlines', {
                      tab: 'conference',
                      id: event.linkedConferenceDeadlineId ?? ''
                    })
                  }
                >
                  <Link2 aria-hidden="true" />
                  Open conference
                </Button>
              )}
              {event.linkedMilestoneId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate('timeline', { milestoneId: event.linkedMilestoneId ?? '' })
                  }
                >
                  <Route aria-hidden="true" />
                  Open milestone
                </Button>
              )}
            </div>
          )}
        </SheetBody>
        <SheetFooter className="sm:justify-between">
          {event.sourceManaged && event.linkedConferenceDeadlineId ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={removeConference.isPending}
              onClick={() =>
                removeConference.mutate(event.linkedConferenceDeadlineId ?? '', {
                  onSuccess: closeAfter
                })
              }
            >
              <CalendarX aria-hidden="true" />
              Remove from calendar
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          )}
          {!event.sourceManaged && (
            <Button onClick={() => onEdit(occurrence)}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          )}
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
      </SheetContent>
    </Sheet>
  )
}
