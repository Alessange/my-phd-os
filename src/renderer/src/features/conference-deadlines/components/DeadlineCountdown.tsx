import {
  calculateRemainingTime,
  countdownSegments,
  formatCountdown,
  formatRelative,
  type CountdownSegment
} from '@shared/dates/countdown'
import type { ConferenceStatus } from '@shared/types/conference'
import { useNow, type NowPrecision } from '@renderer/hooks/useNow'
import { cn } from '@renderer/lib/utils'

export type DeadlineCountdownSize = 'hero' | 'row' | 'compact'

export interface DeadlineCountdownProps {
  targetIso?: string
  /** Omit for deadlines that are not conferences; only `tbd` changes the output. */
  status?: ConferenceStatus
  /**
   * `hero` is the one 64 px numeral of the app (signal ink under 24 h), `row` is a 28 px row
   * figure, `compact` an 18 px figure for dense lists and the Calendar panel.
   */
  size?: DeadlineCountdownSize
  className?: string
}

const UNIT_LETTER: Record<CountdownSegment['unit'], string> = {
  day: 'd',
  hour: 'h',
  minute: 'm',
  second: 's'
}

/**
 * Countdown of the Deadlines page in the editorial form: numerals with small unit letters, two
 * segments (`9 d 09 h`) until the last day, then `09 h 29 m` plus seconds. `Passed 2 days ago` is
 * italic ink-3, `TBD` never carries a figure. Minute precision normally, second precision only
 * once less than a day remains (spec §18). Ink everywhere; only the hero turns to signal, and only
 * under 24 h (the caller prints the `Urgent` word beside it).
 */
export function DeadlineCountdown({
  targetIso,
  status,
  size = 'row',
  className
}: DeadlineCountdownProps): React.JSX.Element {
  const minuteNow = useNow({ precision: 'minute' })
  if (!targetIso || status === 'tbd') {
    return (
      <span
        className={cn('text-ink-3', size === 'compact' ? 'text-lead' : 'text-title', className)}
        data-countdown="tbd"
        aria-label="Deadline to be announced"
      >
        TBD
      </span>
    )
  }
  const probe = calculateRemainingTime(targetIso, minuteNow)
  const precision: NowPrecision = probe.isUnder24h && !probe.isPast ? 'second' : 'minute'
  return <Ticker targetIso={targetIso} precision={precision} size={size} className={className} />
}

function Ticker({
  targetIso,
  precision,
  size,
  className
}: {
  targetIso: string
  precision: NowPrecision
  size: DeadlineCountdownSize
  className?: string
}): React.JSX.Element {
  const now = useNow({ precision })
  const remaining = calculateRemainingTime(targetIso, now)
  const spoken = formatCountdown(remaining, { style: 'long' })

  if (remaining.isPast) {
    return (
      <span
        className={cn('text-body text-ink-3 italic', className)}
        data-countdown="past"
        aria-label={spoken}
      >
        Passed <span className="tabular">{formatRelative(targetIso, now)}</span>
      </span>
    )
  }

  const hero = size === 'hero'
  const urgent = remaining.isUnder24h
  const signal = hero && urgent
  // Days first (`9 d 09 h`); in the last day hours, minutes and seconds.
  const segments = countdownSegments(remaining).slice(0, remaining.days > 0 ? 2 : 3)
  return (
    <span
      className={cn('tabular inline-flex items-baseline gap-2 whitespace-nowrap', className)}
      data-countdown={urgent ? 'urgent' : 'future'}
      role="group"
      aria-label={`${spoken} remaining`}
    >
      {segments.map((segment) => {
        const seconds = segment.unit === 'second'
        const numeral = hero
          ? seconds
            ? 'text-lead'
            : 'text-hero'
          : seconds
            ? 'text-meta'
            : size === 'row'
              ? 'text-title'
              : 'text-lead'
        const unit = hero && !seconds ? 'text-lead' : 'text-meta'
        return (
          <span key={segment.unit} className="inline-flex items-baseline gap-1">
            <span className={cn(numeral, signal ? 'text-signal' : 'text-ink')}>
              {segment.value}
            </span>
            <i
              aria-hidden="true"
              className={cn('not-italic', unit, signal ? 'text-signal' : 'text-ink-3')}
            >
              {UNIT_LETTER[segment.unit]}
            </i>
          </span>
        )
      })}
    </span>
  )
}
