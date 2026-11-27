import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export interface PageHeaderProps {
  title: string
  /**
   * One calm lead sentence tucked under the title (`4 of 5 done today.`), 18 px ink-2. It lives in
   * the head (44 px title + 2 px + 26 px sentence = 72 px) so it never needs a negative margin; a
   * component that renders its own `<p>` (Deadlines' summary) can be passed as is.
   */
  subtitle?: ReactNode
  /** Right-aligned on the title baseline: tabs, a view switch, text links. Not the primary button (use `PageAction`). */
  actions?: ReactNode
  /** Rendered below the head (filters, a note), after the 12 px gap. */
  children?: ReactNode
  /** Keep the `h1` for assistive technology and tests but do not draw it (Calendar's range title is the headline). */
  hideTitle?: boolean
  className?: string
}

/**
 * One visible `h1` per page, 40 px, regular weight; tabs or a view switch sit at the right on the
 * title baseline. The title's top is fixed (`Page` pads 18 px under the strip), so it never jumps
 * between pages; the head is 44 px, or 72 px with a subtitle (44 + 2 + 26), and the page's own
 * gap follows it.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  hideTitle = false,
  className
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className={cn('text-display text-ink', hideTitle && 'sr-only')}>{title}</h1>
          {subtitle && <div className="mt-0.5 text-lead text-ink-2">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-baseline gap-5">{actions}</div>}
      </div>
      {children}
    </header>
  )
}
