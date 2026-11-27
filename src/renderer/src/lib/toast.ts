import type { CSSProperties } from 'react'
import { toast, type ToasterProps } from 'sonner'
import { AppError } from '@shared/errors'
import { isApiError } from './api'

export interface ToastErrorOptions {
  /** Shown as an action button; re-runs the failed operation. */
  retry?: () => void | Promise<unknown>
  /** Overrides the toast title (defaults to a code-based phrase). */
  title?: string
}

const TITLE_BY_CODE: Partial<Record<AppError['code'], string>> = {
  VALIDATION: 'Some values are invalid',
  NOT_FOUND: 'That item no longer exists',
  CONFLICT: 'This conflicts with existing data',
  NOT_IMPLEMENTED: 'Not available yet',
  IO: 'Could not read or write the file',
  NETWORK: 'Network unavailable',
  TIMEOUT: 'The request timed out',
  INVALID_URL: 'Invalid URL',
  UNTRUSTED_HOST: 'Untrusted source',
  INVALID_ICS: 'Invalid .ics file',
  INVALID_BACKUP: 'Invalid backup file',
  UNSUPPORTED_BACKUP_VERSION: 'Unsupported backup version',
  MIGRATION_FAILED: 'Database upgrade failed',
  PERMISSION: 'Permission denied',
  INTERNAL: 'Something went wrong'
}

export const describeError = (error: unknown): { title: string; message: string } => {
  if (error instanceof AppError) {
    const title = TITLE_BY_CODE[error.code] ?? 'Something went wrong'
    const message = isApiError(error) ? `${error.message} (${error.channel})` : error.message
    return { title, message }
  }
  if (error instanceof Error) return { title: 'Something went wrong', message: error.message }
  return { title: 'Something went wrong', message: String(error) }
}

/**
 * Toaster configuration (DESIGN.md section 6): the popover surface with its hairline ring and soft
 * shadow, 360 wide, bottom right 24 px, 15 px text, no richColors, no icons, no corner close. Colours
 * are the app tokens, so light and dark follow the theme. Actions are plain underlined words
 * (`Undo`, `Retry`, `Dismiss`).
 */
export const toasterProps: Pick<
  ToasterProps,
  'position' | 'offset' | 'gap' | 'closeButton' | 'style' | 'toastOptions'
> = {
  position: 'bottom-right',
  offset: 24,
  gap: 8,
  closeButton: false,
  style: {
    '--width': '360px',
    '--border-radius': '8px',
    '--normal-bg': 'var(--popover)',
    '--normal-text': 'var(--popover-foreground)',
    '--normal-border': 'var(--line)',
    fontFamily: 'inherit'
  } as CSSProperties,
  toastOptions: {
    classNames: {
      toast: 'shadow-md! border-0! rounded-lg! p-4! text-sm! gap-3!',
      title: 'text-sm! font-normal! text-ink!',
      description: 'text-xs! text-ink-3!',
      icon: 'hidden!',
      actionButton:
        'bg-transparent! text-ink! underline! underline-offset-4! decoration-1! h-auto! px-1! font-normal! text-sm! rounded-none! ml-auto!',
      cancelButton:
        'bg-transparent! text-ink-2! underline! underline-offset-4! decoration-1! h-auto! px-1! font-normal! text-sm! rounded-none!'
    }
  }
}

/** Reversible action done: an 8 s Undo toast that pauses on hover (sonner default) replaces a confirm dialog. */
export const toastUndo = (title: string, undo: () => void | Promise<unknown>): void => {
  toast(title, {
    duration: 8000,
    action: { label: 'Undo', onClick: () => void undo() }
  })
}

/** Error toast with the failure explained and an optional Retry action. Cancelled dialogs are silent by design. */
export const toastError = (error: unknown, options: ToastErrorOptions = {}): void => {
  if (error instanceof AppError && error.code === 'CANCELED') return
  const { title, message } = describeError(error)
  // Errors persist until dismissed (there is no corner close): Retry when possible, always Dismiss.
  toast.error(options.title ?? title, {
    description: message,
    duration: Infinity,
    action: options.retry ? { label: 'Retry', onClick: () => void options.retry?.() } : undefined,
    cancel: { label: 'Dismiss', onClick: () => undefined }
  })
}

export const toastSuccess = (title: string, description?: string): void => {
  toast.success(title, { description })
}

export const toastInfo = (title: string, description?: string): void => {
  toast(title, { description })
}

export { toast }
