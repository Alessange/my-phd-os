import { calculateRemainingTime, formatCountdown, formatRelative } from '@shared/dates/countdown'
import type { ConferenceStatus } from '@shared/types/conference'
import { useNow, type NowPrecision } from '@renderer/hooks/useNow'
import { cn } from '@renderer/lib/utils'

export interface DeadlineCountdownProps {
  targetIso?: string
  status: ConferenceStatus
  className?: string
}

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Big-number countdown for the board: `32` d (+ hours), `08h 14m` (+ seconds, red) under 24 h,
 * `Passed · 2 days ago` in grey, `TBD` when upstream has no date. Minute precision normally, second
 * precision only once less than a day remains (spec §18).
 */
export function DeadlineCountdown({
  targetIso,
  status,
  className
}: DeadlineCountdownProps): React.JSX.Element {
  const minuteNow = useNow({ precision: 'minute' })
  if (!targetIso || status === 'tbd') {
    return (
      <span
        className={cn('text-lg font-semibold text-status-tbd', className)}
        data-countdown="tbd"
        aria-label="Deadline to be announced"
      >
        TBD
      </span>
    )
  }
  const probe = calculateRemainingTime(targetIso, minuteNow)
  const precision: NowPrecision = probe.isUnder24h && !probe.isPast ? 'second' : 'minute'
  return <Ticker targetIso={targetIso} precision={precision} className={className} />
}

function Ticker({
  targetIso,
  precision,
  className
}: {
  targetIso: string
  precision: NowPrecision
  className?: string
}): React.JSX.Element {
  const now = useNow({ precision })
  const remaining = calculateRemainingTime(targetIso, now)
  const spoken = formatCountdown(remaining, { style: 'long' })

  if (remaining.isPast) {
    return (
      <span
        className={cn('flex flex-col items-end leading-none', className)}
        data-countdown="past"
        aria-label={spoken}
      >
        <span className="text-base font-semibold text-status-passed">Passed</span>
        <span className="tabular mt-0.5 text-[11px] text-muted-foreground">
          {formatRelative(targetIso, now)}
        </span>
      </span>
    )
  }
  if (remaining.isUnder24h) {
    return (
      <span
        className={cn('tabular flex flex-col items-end leading-none text-status-urgent', className)}
        data-countdown="urgent"
        aria-label={`${spoken} remaining`}
      >
        <span className="text-2xl font-bold">
          {pad(remaining.hours)}
          <span className="text-sm font-semibold">h</span> {pad(remaining.minutes)}
          <span className="text-sm font-semibold">m</span>
        </span>
        <span className="mt-0.5 text-[11px] font-medium">{pad(remaining.seconds)} s</span>
      </span>
    )
  }
  return (
    <span
      className={cn('tabular flex flex-col items-end leading-none', className)}
      data-countdown="future"
      aria-label={`${spoken} remaining`}
    >
      <span className="text-2xl font-bold">
        {remaining.days}
        <span className="ml-0.5 text-sm font-semibold text-muted-foreground">d</span>
      </span>
      <span className="mt-0.5 text-[11px] text-muted-foreground">{pad(remaining.hours)} h</span>
    </span>
  )
}
