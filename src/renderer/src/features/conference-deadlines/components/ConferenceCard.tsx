import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { conferenceSubline, followedTimeProgress, urgencyLevel } from '@shared/conferences/views'
import { FOLLOW_INTENTION_LABELS } from '@shared/constants/conferenceLabels'
import { tryResolveZone } from '@shared/dates/zones'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { ZonedTime } from '@renderer/components/common/ZonedTime'
import { Button } from '@renderer/components/ui/button'
import { Progress } from '@renderer/components/ui/progress'
import { StatusMark } from '@renderer/components/ui/status-mark'
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'
import { DeadlineCountdown } from './DeadlineCountdown'

export interface ConferenceCardActions {
  onFollow: (item: ConferenceDeadlineView) => void
  onUnfollow: (item: ConferenceDeadlineView) => void
  onEditFollow: (item: ConferenceDeadlineView) => void
  onAddToCalendar: (item: ConferenceDeadlineView) => void
  onRemoveFromCalendar: (item: ConferenceDeadlineView) => void
}

export interface ConferenceCardProps extends ConferenceCardActions {
  item: ConferenceDeadlineView
  nowIso: string
  /** The record has unacknowledged upstream changes. */
  updated?: boolean
  /** Deep-linked card; marked with a 2 px ink rule and scrolled into view by the tab. */
  highlighted?: boolean
  /** A mutation for this card is in flight. */
  busy?: boolean
  /** Hide the title and full name (the details sheet shows them as its heading). */
  compactHeader?: boolean
}

const DAY_MS = 86_400_000
const daysText = (ms: number): string => {
  const days = Math.floor(ms / DAY_MS)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** One labelled line of the sheet; the hairline above it is the only structure. */
function Field({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-baseline gap-x-4 border-t border-line py-3">
      <dt className="text-meta text-ink-3">{label}</dt>
      <dd className="text-body min-w-0 text-ink">{children}</dd>
    </div>
  )
}

/**
 * Conference details as a flat document (spec §12.4, DESIGN.md section 6, Sheet): every upstream
 * field the feed provided (never a fabricated one), the deadline in its original timezone and in
 * local time, the exact countdown, then follow and calendar actions. Sections are separated by
 * hairlines, nothing is a chip or a card. Canonical fields are read-only here by design (§12.3).
 */
export function ConferenceCard({
  item,
  nowIso,
  updated = false,
  highlighted = false,
  busy = false,
  compactHeader = false,
  onFollow,
  onUnfollow,
  onEditFollow,
  onAddToCalendar,
  onRemoveFromCalendar
}: ConferenceCardProps): React.JSX.Element {
  const format = useFormat()
  const followed = item.followed
  const onCalendar = followed?.calendarEventId !== undefined
  const tbd = item.status === 'tbd' || !item.deadlineAt
  const zoneLabel = item.originalTimezoneLabel ?? item.originalTimezone
  const originalZone = zoneLabel && tryResolveZone(zoneLabel) ? zoneLabel : item.originalTimezone
  const datesText =
    item.conferenceDatesText ??
    (item.conferenceStartAt && item.conferenceEndAt
      ? format.formatDateRange(item.conferenceStartAt, item.conferenceEndAt)
      : undefined)
  const progress = followedTimeProgress(item, nowIso)
  const urgent = urgencyLevel(item, nowIso) === 'urgent'
  // One plain line: category and ranks, the same words the row shows under its title.
  const identity = [item.category, conferenceSubline(item)].filter(Boolean).join(' · ')

  return (
    <article
      aria-label={item.title}
      data-conference-id={item.id}
      data-status={item.status}
      data-highlighted={highlighted || undefined}
      className={cn('flex flex-col gap-6', item.status === 'passed' && 'text-ink-2')}
    >
      {!compactHeader && (
        <header className="flex flex-col gap-1">
          <h3 className="text-title truncate" title={item.title}>
            {item.title}
          </h3>
          {item.fullName && (
            <p className="text-body truncate text-ink-2" title={item.fullName}>
              {item.fullName}
            </p>
          )}
        </header>
      )}

      {(identity || updated || followed || item.status !== 'upcoming') && (
        <div className="flex flex-col gap-1">
          {identity && <p className="text-body text-ink-2">{identity}</p>}
          <p className="text-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-3">
            {item.status !== 'upcoming' && <StatusBadge status={item.status} size="sm" hideIcon />}
            {updated && <span data-testid="updated-badge">Updated from CCF Deadlines</span>}
            {followed && (
              <span>
                Following
                {followed.intention ? ` · ${FOLLOW_INTENTION_LABELS[followed.intention]}` : ''}
              </span>
            )}
          </p>
        </div>
      )}

      <dl className="flex flex-col border-b border-line">
        <Field label="Deadline">
          {item.deadlineAt && !tbd ? (
            <ZonedTime instantIso={item.deadlineAt} originalZone={originalZone} layout="stacked" />
          ) : (
            <span className="text-ink-3 italic">No deadline announced upstream</span>
          )}
        </Field>
        <Field label={item.status === 'passed' ? 'Passed' : 'Remaining'}>
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <DeadlineCountdown
              targetIso={tbd ? undefined : item.deadlineAt}
              status={item.status}
              size="row"
            />
            {urgent && (
              <StatusMark
                label="Urgent"
                colorToken="status-urgent"
                size="md"
                glyph={<CircleAlert aria-hidden="true" />}
              />
            )}
          </span>
        </Field>
        {item.location && (
          <Field label="Location">
            <span className="min-w-0">{item.location}</span>
          </Field>
        )}
        {datesText && <Field label="Conference">{datesText}</Field>}
        {progress && (
          <Field label="Since following">
            <span className="flex flex-col gap-2">
              <span className="text-body text-ink-2">
                {progress.totalMs >= DAY_MS
                  ? `${daysText(progress.elapsedMs)} of ${daysText(progress.totalMs)}`
                  : 'Less than a day to go'}
              </span>
              <Progress
                value={progress.fraction * 100}
                aria-label="Time elapsed since you followed"
                indicatorClassName="bg-progress-time"
                size="sm"
              />
            </span>
          </Field>
        )}
        {followed?.progress !== undefined && followed.progress > 0 && (
          <Field label="Submission">
            <span className="flex flex-col gap-2">
              <span className="tabular text-body text-ink-2">{followed.progress}%</span>
              <Progress
                value={followed.progress}
                aria-label="Submission progress"
                indicatorClassName="bg-progress-work"
                size="sm"
              />
            </span>
          </Field>
        )}
        {followed?.notes && (
          <Field label="Notes">
            <span className="whitespace-pre-line text-ink-2" data-testid="follow-notes">
              {followed.notes}
            </span>
          </Field>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {followed ? (
          <>
            <button
              type="button"
              className="link-quiet app-no-drag disabled:opacity-50"
              disabled={busy}
              onClick={() => onUnfollow(item)}
            >
              Unfollow
            </button>
            <button
              type="button"
              className="link app-no-drag"
              disabled={busy}
              onClick={() => onEditFollow(item)}
            >
              Intention & notes
            </button>
          </>
        ) : (
          <Button disabled={busy} onClick={() => onFollow(item)}>
            Follow
          </Button>
        )}
        {onCalendar ? (
          <button
            type="button"
            className="link app-no-drag"
            disabled={busy}
            onClick={() => onRemoveFromCalendar(item)}
          >
            Remove from calendar
          </button>
        ) : (
          <button
            type="button"
            className="link app-no-drag disabled:opacity-50"
            disabled={busy || tbd}
            title={
              tbd
                ? 'No deadline announced yet, so nothing can be placed on the calendar.'
                : undefined
            }
            onClick={() => onAddToCalendar(item)}
          >
            Add to Calendar
          </button>
        )}
      </div>

      <p className="text-meta flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-3">
        {item.homepageUrl && (
          <a href={item.homepageUrl} target="_blank" rel="noreferrer" className="link-quiet">
            Homepage
          </a>
        )}
        {item.dblpUrl && (
          <a href={item.dblpUrl} target="_blank" rel="noreferrer" className="link-quiet">
            DBLP
          </a>
        )}
        <span title={item.sourceUrl}>From {item.subscriptionLabel}</span>
      </p>
    </article>
  )
}
