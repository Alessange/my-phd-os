import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

/**
 * The page column (DESIGN.md section 5): padding-x 64 (32 under a 1100 px window), max width 1096,
 * left aligned in the main area, title 18 px below the top strip. Calendar and the Timeline Gantt
 * are full-bleed and do not use it.
 *
 *   <Page><PageHeader title="Deadlines" actions={<Tabs/>} />...</Page>
 */
export function Page({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="page"
      className={cn('page-column flex flex-col gap-6 pt-[18px] pb-16', className)}
      {...props}
    />
  )
}
