import {
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  CalendarX,
  CalendarRange,
  ExternalLink,
  MapPin,
  NotebookPen,
  RefreshCw
} from 'lucide-react'
import { followedTimeProgress } from '@shared/conferences/views'
import { FOLLOW_INTENTION_LABELS } from '@shared/constants/conferenceLabels'
import { tryResolveZone } from '@shared/dates/zones'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import { Countdown } from '@renderer/components/common/Countdown'
import { ProgressBar } from '@renderer/components/common/ProgressBar'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { ZonedTime } from '@renderer/components/common/ZonedTime'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'

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
  /** Deep-linked card; drawn with a ring and scrolled into view by the tab. */
  highlighted?: boolean
  /** A mutation for this card is in flight. */
  busy?: boolean
  /** Hide the title and full name (the details sheet shows them as its heading). */
  compactHeader?: boolean
}

const daysText = (ms: number): string => {
  const days = Math.floor(ms / 86_400_000)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * Conference card (spec §12.4): every upstream field the feed provided (never a fabricated one),
 * the deadline in its original timezone and in local time, the exact countdown as the most
 * prominent element, follow / calendar actions and, once followed, a clearly labelled
 * time-elapsed bar. Canonical fields are read-only here by design (§12.3).
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
  const round = item.deadlineRound ?? item.comment
  const progress = followedTimeProgress(item, nowIso)

  return (
    <article
      aria-label={item.title}
      data-conference-id={item.id}
      data-status={item.status}
      data-highlighted={highlighted || undefined}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-xs transition-shadow',
        highlighted && 'ring-2 ring-ring',
        item.status === 'passed' && 'opacity-80'
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {!compactHeader && (
            <h3 className="truncate text-sm font-semibold" title={item.title}>
              {item.title}
            </h3>
          )}
          {!compactHeader && item.fullName && (
            <p className="truncate text-xs text-muted-foreground" title={item.fullName}>
              {item.fullName}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.category && <Badge variant="outline">{item.category}</Badge>}
            {item.ccfRank && <Badge variant="secondary">CCF {item.ccfRank}</Badge>}
            {item.coreRank && <Badge variant="secondary">CORE {item.coreRank}</Badge>}
            {item.thcplRank && <Badge variant="secondary">TH-CPL {item.thcplRank}</Badge>}
            {item.deadlineKind === 'abstract' && <Badge variant="outline">Abstract</Badge>}
            {round && (
              <Badge variant="outline" className="max-w-56 truncate" title={round}>
                {round}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={item.status} size="sm" />
          {updated && (
            <Badge colorToken="status-at-risk" data-testid="updated-badge">
              <RefreshCw aria-hidden="true" />
              Updated from CCF Deadlines
            </Badge>
          )}
          {followed && (
            <Badge colorToken="status-ahead">
              <BookmarkCheck aria-hidden="true" />
              Following
              {followed.intention ? ` · ${FOLLOW_INTENTION_LABELS[followed.intention]}` : ''}
            </Badge>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-xs">
          {item.deadlineAt && !tbd ? (
            <ZonedTime instantIso={item.deadlineAt} originalZone={originalZone} layout="stacked" />
          ) : (
            <span className="font-medium text-status-tbd">No deadline announced upstream</span>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
            {item.status === 'passed' ? 'Deadline' : 'Remaining'}
          </div>
          <Countdown
            targetIso={tbd ? undefined : item.deadlineAt}
            variant={item.status === 'upcoming' ? 'stacked' : 'inline'}
            className={item.status === 'upcoming' ? undefined : 'text-sm font-semibold'}
          />
        </div>
      </div>

      {(item.location || datesText) && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {item.location && (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Location</dt>
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <dd className="truncate">{item.location}</dd>
            </div>
          )}
          {datesText && (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Conference dates</dt>
              <CalendarRange className="size-3.5 shrink-0" aria-hidden="true" />
              <dd className="truncate">{datesText}</dd>
            </div>
          )}
        </dl>
      )}

      {progress && (
        <ProgressBar
          label="Time elapsed since you followed"
          value={progress.fraction * 100}
          valueText={
            progress.totalMs > 0
              ? `${daysText(progress.elapsedMs)} of ${daysText(progress.totalMs)}`
              : 'Deadline reached'
          }
          indicatorClassName="bg-progress-time"
          size="sm"
        />
      )}

      {followed?.notes && (
        <p className="text-xs whitespace-pre-line text-muted-foreground" data-testid="follow-notes">
          {followed.notes}
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t pt-3">
        {followed ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onUnfollow(item)}>
              <BookmarkCheck aria-hidden="true" />
              Unfollow
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onEditFollow(item)}>
              <NotebookPen aria-hidden="true" />
              Intention & notes
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => onFollow(item)}>
            <Bookmark aria-hidden="true" />
            Follow
          </Button>
        )}
        {onCalendar ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onRemoveFromCalendar(item)}
          >
            <CalendarX aria-hidden="true" />
            Remove from calendar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || tbd}
            title={
              tbd
                ? 'No deadline announced yet, so nothing can be placed on the calendar.'
                : undefined
            }
            onClick={() => onAddToCalendar(item)}
          >
            <CalendarPlus aria-hidden="true" />
            Add to Calendar
          </Button>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {item.homepageUrl && (
            <a
              href={item.homepageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
              Homepage
            </a>
          )}
          {item.dblpUrl && (
            <a
              href={item.dblpUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
              DBLP
            </a>
          )}
          <span title={item.sourceUrl}>From {item.subscriptionLabel}</span>
        </span>
      </footer>
    </article>
  )
}
