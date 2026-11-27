import { useState, type ReactNode } from 'react'
import { dateKeyInZone } from '@shared/dates'
import type { DescribedDeadline } from '@shared/personal-deadlines/views'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { useNavigation } from '@renderer/app/navigation'
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
import { DeadlineCountdown } from '@renderer/features/conference-deadlines/components/DeadlineCountdown'
import { useMilestones } from '@renderer/features/timeline/api'
import { useFormat } from '@renderer/hooks/useFormat'
import {
  useDeletePersonalDeadline,
  useLinkCalendarEvent,
  useSetDeadlineProgress,
  useUnlinkCalendarEvent,
  useUpdatePersonalDeadline
} from '../api'
import { DeadlineMeta } from './DeadlineMeta'

/** One labelled line of the sheet; the hairline above it is the only structure. */
function Field({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] items-baseline gap-x-4 border-t border-line py-3">
      <dt className="text-meta text-ink-3">{label}</dt>
      <dd className="text-body min-w-0 text-ink">{children}</dd>
    </div>
  )
}

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
      <SheetContent
        side="right"
        onOpenAutoFocus={(event) => {
          // Land on the sheet, not on the progress input (which would open with its text selected).
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).focus()
        }}
      >
        <SheetHeader>
          <SheetTitle>{deadline.title}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-baseline gap-x-3 text-ink-2">
              <DeadlineMeta deadline={deadline} className="text-body text-ink-2" />
              <StatusBadge status={computed.status} size="md" attentionGlyphOnly />
              <span className="sr-only">
                {computed.remaining.isPast
                  ? 'The deadline has passed.'
                  : 'Time remaining until the deadline.'}
              </span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-8 pb-4">
          <DeadlineCountdown targetIso={deadline.deadlineAt} size="row" />

          <DualProgress
            timePercent={computed.timeProgress.clamped * 100}
            workPercent={deadline.progress}
            paceDifference={computed.paceDifference}
          />

          <section aria-labelledby="deadline-progress-heading" className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="deadline-progress-heading" className="text-lead text-ink-2">
                Update work progress
              </h3>
              <div className="flex items-baseline gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={draft}
                  onChange={(e) =>
                    setDraft(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                  }
                  aria-label="Work progress"
                  className="tabular w-16 text-right"
                />
                <span className="text-meta text-ink-3">%</span>
              </div>
            </div>
            <Slider
              value={[draft]}
              onValueChange={(v) => setDraft(v[0] ?? 0)}
              aria-label="Work progress slider"
            />
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                className="link app-no-drag disabled:opacity-50"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    id: deadline.id,
                    patch: { status: completed ? 'in_progress' : 'completed' }
                  })
                }
              >
                {completed ? 'Reopen' : 'Mark completed'}
              </button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!dirty || setProgress.isPending}
                onClick={() => setProgress.mutate({ id: deadline.id, progress: draft })}
              >
                Save progress
              </Button>
            </div>
          </section>

          <dl className="flex flex-col border-b border-line">
            <Field label="Tracking start">
              <span className="tabular">
                {format.formatDateTimeWithZone(deadline.trackingStartAt, deadline.timezone)}
              </span>
            </Field>
            <Field label="Deadline">
              <ZonedTime
                instantIso={deadline.deadlineAt}
                originalZone={deadline.timezone}
                layout="stacked"
              />
            </Field>
            <Field label="Timezone">{deadline.timezone}</Field>
            {deadline.description && (
              <Field label="Description">
                <span className="whitespace-pre-wrap">{deadline.description}</span>
              </Field>
            )}
            {deadline.location && <Field label="Location">{deadline.location}</Field>}
            {deadline.sourceUrl && (
              <Field label="Source">
                <a
                  href={deadline.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="link block max-w-full truncate"
                >
                  {deadline.sourceUrl}
                </a>
              </Field>
            )}
            {tags.length > 0 && (
              <Field label="Tags">{tags.map((tag) => `#${tag}`).join(' · ')}</Field>
            )}
            <Field label="Milestone">
              {milestone ? (
                <button
                  type="button"
                  className="link app-no-drag text-left"
                  onClick={() => navigate('timeline', { milestoneId: milestone.id })}
                >
                  {milestone.title}
                </button>
              ) : (
                <span className="text-ink-3">Not linked</span>
              )}
            </Field>
            <Field label="Calendar">
              <span className="flex flex-wrap gap-x-5 gap-y-1">
                {deadline.linkedCalendarEventId ? (
                  <>
                    <button
                      type="button"
                      className="link app-no-drag"
                      onClick={() =>
                        navigate('calendar', {
                          date: dateKeyInZone(deadline.deadlineAt, format.zone),
                          eventId: deadline.linkedCalendarEventId ?? ''
                        })
                      }
                    >
                      Open in Calendar
                    </button>
                    <button
                      type="button"
                      className="link-quiet app-no-drag"
                      onClick={() => setUnlinkOpen(true)}
                    >
                      Unlink…
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="link app-no-drag disabled:opacity-50"
                      disabled={link.isPending}
                      onClick={() => link.mutate({ id: deadline.id, mode: 'allDay' })}
                    >
                      Add as all-day
                    </button>
                    <button
                      type="button"
                      className="link app-no-drag disabled:opacity-50"
                      disabled={link.isPending}
                      onClick={() => link.mutate({ id: deadline.id, mode: 'exact' })}
                    >
                      Add with exact time
                    </button>
                  </>
                )}
              </span>
            </Field>
          </dl>
        </SheetBody>

        <SheetFooter className="sm:justify-between">
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          <Button onClick={() => onEdit(deadline)}>Edit</Button>
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
                variant="ghost"
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
