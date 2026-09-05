import { CalendarPlus, CalendarX, ExternalLink, Pencil, Route, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { PRIORITY_DEFINITIONS } from '@shared/constants/statuses'
import { dateKeyInZone } from '@shared/dates'
import type { DescribedDeadline } from '@shared/personal-deadlines/views'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { useNavigation } from '@renderer/app/navigation'
import { CategoryChip } from '@renderer/components/common/CategoryChip'
import { Countdown } from '@renderer/components/common/Countdown'
import { DualProgress } from '@renderer/components/common/DualProgress'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
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
import { Input } from '@renderer/components/ui/input'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@renderer/components/ui/sheet'
import { Slider } from '@renderer/components/ui/slider'
import { useMilestones } from '@renderer/features/timeline/api'
import { useFormat } from '@renderer/hooks/useFormat'
import {
  useDeletePersonalDeadline,
  useLinkCalendarEvent,
  useSetDeadlineProgress,
  useUnlinkCalendarEvent,
  useUpdatePersonalDeadline
} from '../api'

export interface PersonalDeadlineDetailsProps {
  /** The deadline shown; nothing renders without one. */
  item?: DescribedDeadline
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (deadline: PersonalDeadline) => void
}

/**
 * Details drawer (spec §13.4): large countdown, both progress bars with pace, tracking start,
 * exact deadline in its own and the local zone, description, source, tags, linked milestone and
 * calendar event, and progress editing through a slider plus a numeric input. Calendar linking
 * (§13.5) lives here: add as all-day or with the exact time, open the event, unlink keeping or
 * removing it.
 */
export function PersonalDeadlineDetails({
  item,
  open,
  onOpenChange,
  onEdit
}: PersonalDeadlineDetailsProps): React.JSX.Element | null {
  const format = useFormat()
  const navigate = useNavigation((state) => state.navigate)
  const milestones = useMilestones()
  const setProgress = useSetDeadlineProgress()
  const update = useUpdatePersonalDeadline()
  const remove = useDeletePersonalDeadline()
  const link = useLinkCalendarEvent()
  const unlink = useUnlinkCalendarEvent()

  const [draft, setDraft] = useState(item?.deadline.progress ?? 0)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Re-seed the progress draft when another deadline is shown or the stored value changes
  // (derived during render, see HabitForm).
  const [seed, setSeed] = useState({ id: item?.deadline.id, progress: item?.deadline.progress })
  if (item && (item.deadline.id !== seed.id || item.deadline.progress !== seed.progress)) {
    setSeed({ id: item.deadline.id, progress: item.deadline.progress })
    setDraft(item.deadline.progress)
  }

  if (!item) return null
  const { deadline, computed } = item
  const milestone = milestones.data?.find((m) => m.id === deadline.linkedMilestoneId)
  const completed = deadline.status === 'completed'
  const dirty = draft !== deadline.progress
  const tags = deadline.tags ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryChip category={deadline.category} marker="icon" tinted />
            <StatusBadge status={PRIORITY_DEFINITIONS[deadline.priority]} size="sm" />
            <StatusBadge status={computed.status} size="sm" />
          </div>
          <SheetTitle>{deadline.title}</SheetTitle>
          <SheetDescription>
            {computed.remaining.isPast
              ? 'The deadline has passed.'
              : 'Time remaining until the deadline.'}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-5">
          <Countdown targetIso={deadline.deadlineAt} variant="large" />

          <DualProgress
            timePercent={computed.timeProgress.clamped * 100}
            workPercent={deadline.progress}
            paceDifference={computed.paceDifference}
          />

          <section
            aria-labelledby="deadline-progress-heading"
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="deadline-progress-heading" className="text-sm font-medium">
                Update work progress
              </h3>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={draft}
                  onChange={(e) =>
                    setDraft(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                  }
                  aria-label="Work progress"
                  className="tabular w-20"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={[draft]}
              onValueChange={(v) => setDraft(v[0] ?? 0)}
              aria-label="Work progress slider"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    id: deadline.id,
                    patch: { status: completed ? 'in_progress' : 'completed' }
                  })
                }
              >
                {completed ? 'Reopen' : 'Mark completed'}
              </Button>
              <Button
                size="sm"
                disabled={!dirty || setProgress.isPending}
                onClick={() => setProgress.mutate({ id: deadline.id, progress: draft })}
              >
                Save progress
              </Button>
            </div>
          </section>

          <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Tracking start</dt>
            <dd className="tabular">
              {format.formatDateTimeWithZone(deadline.trackingStartAt, deadline.timezone)}
            </dd>
            <dt className="text-muted-foreground">Deadline</dt>
            <dd>
              <ZonedTime
                instantIso={deadline.deadlineAt}
                originalZone={deadline.timezone}
                layout="stacked"
              />
            </dd>
            <dt className="text-muted-foreground">Timezone</dt>
            <dd>{deadline.timezone}</dd>
            {deadline.description && (
              <>
                <dt className="text-muted-foreground">Description</dt>
                <dd className="whitespace-pre-wrap">{deadline.description}</dd>
              </>
            )}
            {deadline.location && (
              <>
                <dt className="text-muted-foreground">Location</dt>
                <dd>{deadline.location}</dd>
              </>
            )}
            {deadline.sourceUrl && (
              <>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="min-w-0">
                  <a
                    href={deadline.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"
                  >
                    <span className="truncate">{deadline.sourceUrl}</span>
                    <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  </a>
                </dd>
              </>
            )}
            {tags.length > 0 && (
              <>
                <dt className="text-muted-foreground">Tags</dt>
                <dd className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      #{tag}
                    </Badge>
                  ))}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Milestone</dt>
            <dd>
              {milestone ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={() => navigate('timeline', { milestoneId: milestone.id })}
                >
                  <Route aria-hidden="true" />
                  {milestone.title}
                </Button>
              ) : (
                <span className="text-muted-foreground">Not linked</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Calendar</dt>
            <dd className="flex flex-wrap gap-1.5">
              {deadline.linkedCalendarEventId ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate('calendar', {
                        date: dateKeyInZone(deadline.deadlineAt, format.zone),
                        eventId: deadline.linkedCalendarEventId ?? ''
                      })
                    }
                  >
                    Open in Calendar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setUnlinkOpen(true)}>
                    <CalendarX aria-hidden="true" />
                    Unlink…
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={link.isPending}
                    onClick={() => link.mutate({ id: deadline.id, mode: 'allDay' })}
                  >
                    <CalendarPlus aria-hidden="true" />
                    Add as all-day
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={link.isPending}
                    onClick={() => link.mutate({ id: deadline.id, mode: 'exact' })}
                  >
                    Add with exact time
                  </Button>
                </>
              )}
            </dd>
          </dl>
        </SheetBody>

        <SheetFooter className="sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
          <Button onClick={() => onEdit(deadline)}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        </SheetFooter>

        <AlertDialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unlink from the calendar?</AlertDialogTitle>
              <AlertDialogDescription>
                The deadline stays. You can keep the calendar event as an ordinary event or remove
                it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="outline"
                disabled={unlink.isPending}
                onClick={() =>
                  unlink.mutate(
                    { id: deadline.id, deleteEvent: false },
                    { onSuccess: () => setUnlinkOpen(false) }
                  )
                }
              >
                Keep the event
              </Button>
              <AlertDialogAction
                variant="destructive"
                disabled={unlink.isPending}
                onClick={(event) => {
                  event.preventDefault()
                  unlink.mutate(
                    { id: deadline.id, deleteEvent: true },
                    { onSuccess: () => setUnlinkOpen(false) }
                  )
                }}
              >
                Remove the event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{deadline.title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                The deadline and its progress are removed from this computer
                {deadline.linkedCalendarEventId ? ', together with its linked calendar event' : ''}.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={remove.isPending}
                onClick={(event) => {
                  event.preventDefault()
                  remove.mutate(
                    { id: deadline.id },
                    {
                      onSuccess: () => {
                        setConfirmDelete(false)
                        onOpenChange(false)
                      }
                    }
                  )
                }}
              >
                Delete deadline
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
