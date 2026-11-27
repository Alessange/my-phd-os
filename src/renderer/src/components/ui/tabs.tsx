import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

export function Tabs({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>): React.JSX.Element {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-3', className)}
      {...props}
    />
  )
}

/** Text tabs, gap 28 (pass `gap-5` in toolbars). Same look as `SegmentedControl`. */
export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>): React.JSX.Element {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('inline-flex h-9 w-fit items-center gap-7', className)}
      {...props}
    />
  )
}

/** Inactive ink-3, active ink with a 1.5 px ink underline. Width never shifts: both states are Regular. */
export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>): React.JSX.Element {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-flex h-full items-center justify-center gap-1.5 text-sm whitespace-nowrap text-ink-3 transition-colors duration-100',
        'hover:text-ink data-[state=active]:text-ink disabled:pointer-events-none disabled:opacity-50',
        'after:absolute after:inset-x-0 after:bottom-0 after:h-[1.5px] after:bg-ink after:opacity-0 data-[state=active]:after:opacity-100',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
        className
      )}
      {...props}
    />
  )
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>): React.JSX.Element {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      tabIndex={-1}
      {...props}
    />
  )
}
