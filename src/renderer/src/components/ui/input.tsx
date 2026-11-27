import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

export interface InputProps extends ComponentProps<'input'> {
  /**
   * `field` (default): underline field, 36 high, 1 px edge rule, 2 px ink rule on focus, signal rule
   * when `aria-invalid`. `bare`: borderless text input for toolbars and filters.
   */
  variant?: 'field' | 'bare'
}

/** Text input (DESIGN.md section 6). No box, no shadow: the rule under the text is the control. */
export function Input({
  className,
  type = 'text',
  variant = 'field',
  ...props
}: InputProps): React.JSX.Element {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 px-0 py-1 text-sm text-foreground outline-none',
        'placeholder:text-ink-3 file:border-0 file:bg-transparent file:text-sm',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'field' ? 'field' : 'bg-transparent',
        className
      )}
      {...props}
    />
  )
}
