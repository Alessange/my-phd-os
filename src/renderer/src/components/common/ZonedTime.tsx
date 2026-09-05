import { tryResolveZone } from '@shared/dates/zones'
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'

export interface ZonedTimeProps {
  /** Canonical instant (ISO UTC). */
  instantIso: string
  /** The source's own zone (`AoE`, `UTC-12:00`, `America/Los_Angeles`). Omit when the source gave none. */
  originalZone?: string
  /** Also show the user-local conversion (default `true`). */
  showLocal?: boolean
  /** `stacked` puts the two lines under each other; `inline` joins them with a separator. */
  layout?: 'stacked' | 'inline'
  className?: string
}

/**
 * `Sep 18, 2026 · 23:59 AoE` + `Local: Sep 19, 2026 · 04:59 PDT`. When the source has no zone the
 * component says so explicitly instead of inventing one (spec §18).
 */
export function ZonedTime({
  instantIso,
  originalZone,
  showLocal = true,
  layout = 'stacked',
  className
}: ZonedTimeProps): React.JSX.Element {
  const format = useFormat()
  const original = originalZone ? tryResolveZone(originalZone) : undefined
  const originalText = original ? format.formatDateTimeWithZone(instantIso, original) : undefined
  const localText = format.formatDateTimeWithZone(instantIso)
  const sameZone = original !== undefined && originalText === localText

  return (
    <span
      className={cn(
        'tabular',
        layout === 'stacked'
          ? 'flex flex-col gap-0.5'
          : 'inline-flex flex-wrap items-baseline gap-x-2',
        className
      )}
    >
      {originalText ? (
        <span className="font-medium text-foreground" data-zoned="original">
          {originalText}
        </span>
      ) : (
        <span className="text-foreground" data-zoned="utc">
          <span className="font-medium">{format.formatDateTimeWithZone(instantIso, 'UTC')}</span>
          <span className="ml-1.5 text-xs text-muted-foreground">
            (original timezone unavailable)
          </span>
        </span>
      )}
      {showLocal && !sameZone && (
        <span className="text-xs text-muted-foreground" data-zoned="local">
          Local: {localText}
        </span>
      )}
    </span>
  )
}
