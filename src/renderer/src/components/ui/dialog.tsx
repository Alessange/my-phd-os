import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'
import { useRestoreFocus } from './restore-focus'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>): React.JSX.Element {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-scrim duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

export interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Omit the (screen-reader-only) Close button. There is no visible corner X: Esc and Cancel close the dialog. */
  hideClose?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES: Record<NonNullable<DialogContentProps['size']>, string> = {
  sm: 'sm:max-w-[440px]',
  md: 'sm:max-w-[520px]',
  lg: 'sm:max-w-[560px]',
  xl: 'sm:max-w-[720px]'
}

export function DialogContent({
  className,
  children,
  hideClose = false,
  size = 'md',
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: DialogContentProps): React.JSX.Element {
  const restoreFocus = useRestoreFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100vh-3rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-lg bg-popover p-8 text-popover-foreground shadow-lg outline-none sm:p-10',
          'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          SIZES[size],
          className
        )}
        {...restoreFocus}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="sr-only" aria-label="Close" tabIndex={-1}>
            Close
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-left', className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end',
        className
      )}
      {...props}
    />
  )
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>): React.JSX.Element {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-title', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): React.JSX.Element {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-ink-2', className)}
      {...props}
    />
  )
}
