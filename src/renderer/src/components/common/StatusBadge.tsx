import type { StatusDefinition } from '@shared/constants/statuses'
import { StatusMark } from '@renderer/components/ui/status-mark'
import { DynamicIcon } from './DynamicIcon'
import { isAttentionStatus, resolveStatus } from './statusLookup'

export interface StatusBadgeProps {
  /** A status id (`ahead`, `tbd`, `delayed`, ...) or a full definition from `constants/statuses`. */
  status: string | StatusDefinition
  size?: 'sm' | 'md'
  /** Hide the glyph (the word is always shown: colour is never the only signal). Calm statuses pass this. */
  hideIcon?: boolean
  /** Show the glyph only for attention and exception statuses (urgent, overdue, at risk, behind, completed, ...). */
  attentionGlyphOnly?: boolean
  className?: string
}

/**
 * Status as a word plus, when it matters, a glyph (see `StatusMark`). Same API as before; it no
 * longer draws a tinted pill. `data-status` is kept for tests.
 */
export function StatusBadge({
  status,
  size = 'md',
  hideIcon = false,
  attentionGlyphOnly = false,
  className
}: StatusBadgeProps): React.JSX.Element {
  const definition = resolveStatus(status)
  if (!definition) {
    return <span className={className}>{typeof status === 'string' ? status : 'Unknown'}</span>
  }
  const showGlyph = !hideIcon && (!attentionGlyphOnly || isAttentionStatus(definition.id))
  return (
    <StatusMark
      colorToken={definition.colorToken}
      data-status={definition.id}
      size={size}
      label={definition.label}
      glyph={showGlyph ? <DynamicIcon name={definition.icon} /> : undefined}
      className={className}
    />
  )
}
