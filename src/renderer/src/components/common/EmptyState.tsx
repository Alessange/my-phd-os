import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, type ButtonProps } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

export interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: ButtonProps['variant']
  icon?: LucideIcon
}

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  actions?: EmptyStateAction[]
  /** `compact` renders a one-line variant for right-panel sections and lists. */
  variant?: 'default' | 'compact'
  className?: string
}

/** Designed empty state (spec §19). Strings come from `EMPTY_STATES`; never render placeholder data instead. */
export function EmptyState({
  icon: Icon,
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
        className={cn(
          'flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground',
          className
        )}
      >
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
        <span className="truncate">{title}</span>
        {actions.length > 0 && (
          <span className="ml-auto flex gap-1">
            {actions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.variant ?? 'ghost'}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </span>
        )}
      </div>
    )
  }
  return (
    <div
      role="status"
      className={cn(
        'mx-auto flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center',
        className
      )}
    >
      {Icon && (
        <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={action.label}
              variant={action.variant ?? (index === 0 ? 'default' : 'outline')}
              onClick={action.onClick}
            >
              {action.icon && <action.icon aria-hidden="true" />}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
