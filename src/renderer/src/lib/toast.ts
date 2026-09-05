import { toast } from 'sonner'
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

/** Error toast with the failure explained and an optional Retry action. Cancelled dialogs are silent by design. */
export const toastError = (error: unknown, options: ToastErrorOptions = {}): void => {
  if (error instanceof AppError && error.code === 'CANCELED') return
  const { title, message } = describeError(error)
  toast.error(options.title ?? title, {
    description: message,
    action: options.retry ? { label: 'Retry', onClick: () => void options.retry?.() } : undefined
  })
}

export const toastSuccess = (title: string, description?: string): void => {
  toast.success(title, { description })
}

export const toastInfo = (title: string, description?: string): void => {
  toast(title, { description })
}

export { toast }
