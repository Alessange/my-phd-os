import type { ComponentProps, ReactNode } from 'react'
import { chipStyle, cn } from '@renderer/lib/utils'

export interface StatusMarkProps extends Omit<ComponentProps<'span'>, 'children'> {
  /** The word. Always present: colour is never the only signal. */
  label: ReactNode
  /** Palette token (`status-urgent`, `priority-high`); sets the ink of the word and the glyph. */
  colorToken: string
  /** A 14 px glyph shown before the word; only for attention or exception states. */
  glyph?: ReactNode
  size?: 'sm' | 'md'
}

/**
 * A status as typography (DESIGN.md section 6): the word, plus a glyph only when something needs
 * attention. No fill, border or pill. Calm states are a plain ink-2 word; Urgent and Overdue are
 * signal, At risk and Behind are full ink; Completed is ink-3. The ink comes from the palette token,
 * which already resolves to the right tier in both themes.
 *
 *   <StatusMark label="Urgent" colorToken="status-urgent" glyph={<CircleAlert />} />
 */
export function StatusMark({
  label,
  colorToken,
  glyph,
  size = 'sm',
  className,
  style,
  ...props
}: StatusMarkProps): React.JSX.Element {
  return (
    <span
      data-slot="status-mark"
      style={{ ...chipStyle(colorToken), ...style }}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-(--chip)',
        size === 'sm' ? 'text-xs' : 'text-sm',
        '[&>svg]:size-3.5 [&>svg]:shrink-0',
        className
      )}
      {...props}
    >
      {glyph}
      <span>{label}</span>
    </span>
  )
}
