import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
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

/**
 * One sentence of what failed, a `Retry` text link, persistent and inline: no box, no tinted fill,
 * no icon tile, never "Oops". A small signal glyph is the only colour. Nothing is swallowed.
 */
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
      <div role="alert" className={cn('flex items-baseline gap-2 py-1 text-sm', className)}>
        <CircleAlert className="size-3.5 shrink-0 translate-y-0.5 text-signal" aria-hidden="true" />
        <span className="min-w-0">
          <span className="text-ink">{heading}</span>
          {detail && <span className="text-ink-3"> {detail}</span>}
        </span>
        {onRetry && (
          <button type="button" className="link ml-auto shrink-0" onClick={onRetry}>
            {retryLabel}
          </button>
        )}
        {children}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={cn('flex w-full max-w-xl flex-col items-start gap-3 py-12', className)}
    >
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-title text-ink">
          <CircleAlert className="size-5 shrink-0 text-signal" aria-hidden="true" />
          {heading}
        </h2>
        {detail && <p className="text-sm break-words text-ink-2">{detail}</p>}
      </div>
      {(onRetry || children) && (
        <div className="flex flex-wrap items-center gap-5">
          {onRetry && (
            <button type="button" className="link" onClick={onRetry}>
              {retryLabel}
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
