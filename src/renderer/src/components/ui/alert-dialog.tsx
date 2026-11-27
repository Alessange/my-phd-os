import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'
import { useRestoreFocus } from './restore-focus'
import { buttonVariants } from './button-variants'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger
export const AlertDialogPortal = AlertDialogPrimitive.Portal

export function AlertDialogOverlay({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Overlay>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-scrim duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

export function AlertDialogContent({
  className,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>): React.JSX.Element {
  const restoreFocus = useRestoreFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-lg bg-popover p-8 text-popover-foreground shadow-lg outline-none sm:max-w-[440px] sm:p-10',
          'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          className
        )}
        {...restoreFocus}
        {...props}
      />
    </AlertDialogPortal>
  )
}

export function AlertDialogHeader({
  className,
  ...props
}: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('flex flex-col gap-2 text-left', className)}
      {...props}
    />
  )
}

export function AlertDialogFooter({
  className,
  ...props
}: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end',
        className
      )}
      {...props}
    />
  )
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-title', className)}
      {...props}
    />
  )
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-sm text-ink-2', className)}
      {...props}
    />
  )
}

export function AlertDialogAction({
  className,
  variant = 'default',
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> & {
  /** `destructive` is the solid signal confirm button: the only solid signal fill in the app. */
  variant?: 'default' | 'destructive'
}): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Action
      className={cn(
        buttonVariants({ variant: variant === 'destructive' ? 'danger' : 'default' }),
        className
      )}
      {...props}
    />
  )
}

export function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: 'ghost' }), className)}
      {...props}
    />
  )
}
