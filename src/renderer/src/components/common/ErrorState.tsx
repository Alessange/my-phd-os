import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import { describeError } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

export interface ErrorStateProps {
  /** Either a ready message or the thrown error (described via `describeError`). */
  error?: unknown
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  /** Extra safe next actions. */
  children?: ReactNode
  variant?: 'default' | 'compact'
  className?: string
}

/** Explains what failed and offers a retry or safe next action; nothing is ever swallowed silently. */
export function ErrorState({
  error,
  title,
  message,
  onRetry,
  retryLabel = 'Retry',
  children,
  variant = 'default',
  className
}: ErrorStateProps): React.JSX.Element {
  const described = error === undefined ? undefined : describeError(error)
  const heading = title ?? described?.title ?? 'Something went wrong'
  const detail = message ?? described?.message

  if (variant === 'compact') {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/6 px-3 py-2 text-xs',
          className
        )}
      >
        <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
        <span className="min-w-0 truncate">
          <span className="font-medium">{heading}</span>
          {detail && <span className="text-muted-foreground"> — {detail}</span>}
        </span>
        {onRetry && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {children}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={cn(
        'mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/6 px-6 py-10 text-center',
        className
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-lg bg-destructive/12 text-destructive">
        <CircleAlert className="size-5" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{heading}</h2>
        {detail && <p className="text-[13px] text-muted-foreground break-words">{detail}</p>}
      </div>
      {(onRetry || children) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
          {children}
        </div>
      )}
    </div>
  )
}
