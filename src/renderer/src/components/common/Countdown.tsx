import { calculateRemainingTime, countdownSegments, formatCountdown } from '@shared/dates/countdown'
import { useNow } from '@renderer/hooks/useNow'
import { cn } from '@renderer/lib/utils'

export interface CountdownProps {
  /** Canonical instant; `undefined` renders `TBD` and never invents a date. */
  targetIso?: string
  /** Override "now" (tests, snapshots). When omitted the shared ticker is used. */
  nowIso?: string
  /** Switch to hours/minutes emphasis and second precision when < 24 h remain (default `true`). */
  emphasizeUnder24h?: boolean
  variant?: 'inline' | 'stacked' | 'large'
  className?: string
}

/**
 * Exact remaining time from canonical instants, recomputed on every tick. Never persisted.
 * Precision follows the ticker: once less than 24 h remain (or for the `large` variant) the
 * component re-renders every second (spec §18), otherwise once a minute.
 */
export function Countdown({
  targetIso,
  nowIso,
  emphasizeUnder24h = true,
  variant = 'inline',
  className
}: CountdownProps): React.JSX.Element {
  const minuteNow = useNow({ precision: 'minute' })
  const remaining = targetIso ? calculateRemainingTime(targetIso, nowIso ?? minuteNow) : undefined
  const needsSeconds = emphasizeUnder24h && (remaining?.isUnder24h ?? false)
  return (
    <CountdownTicker
      targetIso={targetIso}
      nowIso={nowIso}
      precision={needsSeconds || variant === 'large' ? 'second' : 'minute'}
      emphasizeUnder24h={emphasizeUnder24h}
      variant={variant}
      className={className}
    />
  )
}

interface TickerProps extends Required<Pick<CountdownProps, 'emphasizeUnder24h' | 'variant'>> {
  targetIso?: string
  nowIso?: string
  precision: 'minute' | 'second'
  className?: string
}

function CountdownTicker({
  targetIso,
  nowIso,
  precision,
  emphasizeUnder24h,
  variant,
  className
}: TickerProps): React.JSX.Element {
  const tickedNow = useNow({ precision })
  const now = nowIso ?? tickedNow

  if (!targetIso) {
    return (
      <span className={cn('font-medium text-status-tbd', className)} data-countdown="tbd">
        TBD
      </span>
    )
  }

  const remaining = calculateRemainingTime(targetIso, now)
  const label = formatCountdown(remaining, { style: 'long' })

  if (remaining.isPast) {
    return (
      <span
        className={cn(
          'tabular font-medium text-status-passed',
          variant === 'large' && 'text-lg',
          className
        )}
        data-countdown="past"
        aria-label={label}
      >
        {label}
      </span>
    )
  }

  const emphasized = emphasizeUnder24h && remaining.isUnder24h
  const segments = countdownSegments(remaining)

  if (variant === 'inline') {
    return (
      <span
        className={cn('tabular font-medium', emphasized && 'text-status-urgent', className)}
        data-countdown={emphasized ? 'urgent' : 'future'}
        aria-label={`${label} remaining`}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'flex items-end gap-3',
        variant === 'stacked' && 'flex-col items-start gap-0.5',
        className
      )}
      data-countdown={emphasized ? 'urgent' : 'future'}
      role="group"
      aria-label={`${label} remaining`}
    >
      {segments.map((segment, index) => {
        const emphasize = emphasized && (segment.unit === 'hour' || segment.unit === 'minute')
        return (
          <span
            key={segment.unit}
            className={cn('flex items-baseline gap-1', variant === 'stacked' && 'gap-1.5')}
          >
            <span
              className={cn(
                'numeric leading-none font-semibold',
                variant === 'large'
                  ? index === 0 || emphasize
                    ? 'text-3xl'
                    : 'text-2xl text-foreground/80'
                  : 'text-base',
                emphasize && 'text-status-urgent'
              )}
            >
              {segment.value}
            </span>
            <span
              className={cn('text-xs text-muted-foreground', emphasize && 'text-status-urgent')}
            >
              {segment.label}
            </span>
          </span>
        )
      })}
    </span>
  )
}
