import type { StatusDefinition } from '@shared/constants/statuses'
import { Badge } from '@renderer/components/ui/badge'
import { DynamicIcon } from './DynamicIcon'
import { cn } from '@renderer/lib/utils'
import { resolveStatus } from './statusLookup'

export interface StatusBadgeProps {
  /** A status id (`ahead`, `tbd`, `delayed`, …) or a full definition from `constants/statuses`. */
  status: string | StatusDefinition
  size?: 'sm' | 'md'
  /** Hide the icon (text is always shown: colour is never the only signal). */
  hideIcon?: boolean
  className?: string
}

export function StatusBadge({
  status,
  size = 'md',
  hideIcon = false,
  className
}: StatusBadgeProps): React.JSX.Element {
  const definition = resolveStatus(status)
  if (!definition) {
    return (
      <Badge variant="outline" className={className}>
        {typeof status === 'string' ? status : 'Unknown'}
      </Badge>
    )
  }
  return (
    <Badge
      colorToken={definition.colorToken}
      data-status={definition.id}
      className={cn(size === 'md' && 'px-2 py-0.5 text-xs', className)}
    >
      {!hideIcon && <DynamicIcon name={definition.icon} />}
      <span>{definition.label}</span>
    </Badge>
  )
}
