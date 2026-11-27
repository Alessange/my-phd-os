import { Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export interface PassedToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Printed after the words (`Show passed (1)`). */
  count?: number
  className?: string
}

/**
 * `Show passed (1)` as a quiet text control that keeps the `switch` role and the name `Show passed`
 * (DESIGN.md section 6). The state is `aria-checked`; a small check glyph shows it when on.
 */
export function PassedToggle({
  checked,
  onCheckedChange,
  count,
  className
}: PassedToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Show passed"
      onClick={() => onCheckedChange(!checked)}
      className={cn('link-quiet app-no-drag inline-flex items-baseline gap-1.5', className)}
    >
      {checked && <Check className="size-3.5 self-center" aria-hidden="true" />}
      Show passed{count !== undefined ? ` (${count})` : ''}
    </button>
  )
}
