import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Right-aligned controls (buttons, view switchers). */
  actions?: ReactNode
  /** Rendered below the title row (tabs, filters). */
  children?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  className
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl leading-tight font-semibold">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}
