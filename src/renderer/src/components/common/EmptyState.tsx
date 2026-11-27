import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, type ButtonProps } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

export interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: ButtonProps['variant']
  /** Ignored: the design carries no icon tile and no icon on empty-state buttons. Kept so call sites compile. */
  icon?: LucideIcon
}

export interface EmptyStateProps {
  /** Ignored: empty states carry no icon (DESIGN.md section 6). Kept so call sites compile. */
  icon?: LucideIcon
  title: string
  description?: ReactNode
  actions?: EmptyStateAction[]
  /** `compact` renders one `role=status` line for right-panel sections and lists. */
  variant?: 'default' | 'compact'
  className?: string
}

/**
 * Designed empty state (spec section 19), borderless: a 28 px title (exact copy from `EMPTY_STATES`),
 * an optional 15 px ink-2 sentence and the actions as text links. The strip already carries the
 * view's one ink primary (DESIGN.md 1, rule 5), so an action is a solid button only when it opts in
 * with `variant: 'default'` (a surface without a strip, such as a dialog). Never render placeholder
 * data instead.
 */
export function EmptyState({
  title,
  description,
  actions = [],
  variant = 'default',
  className
}: EmptyStateProps): React.JSX.Element {
  if (variant === 'compact') {
    return (
      <div
        role="status"
        className={cn('flex items-baseline gap-3 py-1 text-sm text-ink-3', className)}
      >
        <span className="min-w-0 truncate">{title}</span>
        {actions.length > 0 && (
          <span className="ml-auto flex shrink-0 gap-4">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="link-quiet app-no-drag"
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </span>
        )}
      </div>
    )
  }
  return (
    <div
      role="status"
      className={cn('flex w-full max-w-xl flex-col items-start gap-4 py-12', className)}
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-title text-ink">{title}</h2>
        {description && <p className="text-sm text-ink-2">{description}</p>}
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {actions.map((action) =>
            action.variant === 'default' ? (
              <Button key={action.label} onClick={action.onClick}>
                {action.label}
              </Button>
            ) : (
              <button key={action.label} type="button" className="link" onClick={action.onClick}>
                {action.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
