import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'

export function Command({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive>): React.JSX.Element {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground',
        className
      )}
      {...props}
    />
  )
}

export interface CommandDialogProps extends ComponentProps<typeof Dialog> {
  title?: string
  description?: string
  className?: string
}

/** Palette-style dialog: visually hidden title/description keep it accessible. */
export function CommandDialog({
  title = 'Command palette',
  description = 'Search for a command to run',
  children,
  className,
  ...props
}: CommandDialogProps): React.JSX.Element {
  return (
    <Dialog {...props}>
      <DialogContent
        hideClose
        size="md"
        className={cn(
          'top-[16%] translate-y-0 overflow-hidden p-0 sm:max-w-[640px] sm:p-0',
          'data-[state=open]:duration-100 data-[state=closed]:duration-100',
          className
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command
          loop
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2"
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>): React.JSX.Element {
  return (
    <div data-slot="command-input-wrapper" className="flex h-14 items-center gap-3 border-b px-5">
      <Search className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          'flex h-12 w-full bg-transparent text-lead outline-none placeholder:text-ink-3 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
      <span aria-hidden="true" className="shrink-0 text-xs text-ink-3">
        esc
      </span>
    </div>
  )
}

export function CommandList({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.List>): React.JSX.Element {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'max-h-[min(456px,60vh)] scroll-py-1 overflow-x-hidden overflow-y-auto py-2',
        className
      )}
      {...props}
    />
  )
}

export function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>): React.JSX.Element {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn('py-8 text-center text-sm text-ink-3', className)}
      {...props}
    />
  )
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>): React.JSX.Element {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn('overflow-hidden text-foreground', className)}
      {...props}
    />
  )
}

export function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>): React.JSX.Element {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('-mx-1 my-1 h-px bg-line', className)}
      {...props}
    />
  )
}

export function CommandItem({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>): React.JSX.Element {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        'relative flex h-[38px] cursor-default items-center gap-3 rounded-sm px-3 text-sm outline-hidden select-none',
        'data-[selected=true]:bg-selected data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 [&_svg:not([class*="text-"])]:text-ink-3',
        className
      )}
      {...props}
    />
  )
}

export function CommandShortcut({
  className,
  ...props
}: ComponentProps<'span'>): React.JSX.Element {
  return (
    <span
      data-slot="command-shortcut"
      className={cn('ml-auto flex items-center gap-0.5 text-xs text-ink-3', className)}
      {...props}
    />
  )
}
