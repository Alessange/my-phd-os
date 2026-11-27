import * as SheetPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'
import { useRestoreFocus } from './restore-focus'

export const Sheet = SheetPrimitive.Root
export const SheetTrigger = SheetPrimitive.Trigger
export const SheetClose = SheetPrimitive.Close
export const SheetPortal = SheetPrimitive.Portal

export function SheetOverlay({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Overlay>): React.JSX.Element {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-scrim duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

export type SheetSide = 'top' | 'right' | 'bottom' | 'left'

const SIDE_CLASSES: Record<SheetSide, string> = {
  right:
    'inset-y-0 right-0 h-full w-full max-w-[440px] data-[state=closed]:slide-out-to-right-8 data-[state=open]:slide-in-from-right-8',
  left: 'inset-y-0 left-0 h-full w-full max-w-[440px] data-[state=closed]:slide-out-to-left-8 data-[state=open]:slide-in-from-left-8',
  top: 'inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
  bottom:
    'inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom'
}

export function SheetContent({
  className,
  children,
  side = 'right',
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & { side?: SheetSide }): React.JSX.Element {
  const restoreFocus = useRestoreFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed z-50 flex flex-col gap-6 bg-popover text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:duration-150 data-[state=open]:duration-200',
          SIDE_CLASSES[side],
          className
        )}
        {...restoreFocus}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="sr-only" aria-label="Close" tabIndex={-1}>
          Close
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-2 px-8 pt-8', className)}
      {...props}
    />
  )
}

export function SheetBody({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="sheet-body"
      className={cn('flex-1 overflow-y-auto px-8', className)}
      {...props}
    />
  )
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        'mt-auto flex flex-col gap-3 px-8 pb-8 sm:flex-row sm:items-center sm:justify-end',
        className
      )}
      {...props}
    />
  )
}

export function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Title>): React.JSX.Element {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-title', className)}
      {...props}
    />
  )
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>): React.JSX.Element {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-ink-2', className)}
      {...props}
    />
  )
}
