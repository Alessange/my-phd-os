import { APP_ERROR_CODES, type AppErrorCode, type IpcError } from './types/common'

export type { AppErrorCode, IpcError }

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly details?: unknown

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError

export const isAppErrorCode = (value: unknown): value is AppErrorCode =>
  typeof value === 'string' && (APP_ERROR_CODES as readonly string[]).includes(value)

export const isIpcError = (value: unknown): value is IpcError =>
  typeof value === 'object' &&
  value !== null &&
  isAppErrorCode((value as { code?: unknown }).code) &&
  typeof (value as { message?: unknown }).message === 'string'

/** Converts any thrown value into the serialisable envelope sent over IPC. Never throws. */
export const toIpcError = (error: unknown): IpcError => {
  if (isAppError(error)) return { code: error.code, message: error.message, details: error.details }
  if (isIpcError(error)) return { code: error.code, message: error.message, details: error.details }
  if (error instanceof Error) return { code: 'INTERNAL', message: error.message }
  return { code: 'INTERNAL', message: typeof error === 'string' ? error : 'Unknown error' }
}

/** Rebuilds an `AppError` on the receiving side of the bridge. */
export const fromIpcError = (value: unknown): AppError => {
  if (isIpcError(value)) return new AppError(value.code, value.message, value.details)
  if (value instanceof Error) {
    // Electron prefixes rejected invoke() messages with "Error invoking remote method '...': ".
    const embedded = /(\{.*\})$/s.exec(value.message)?.[1]
    if (embedded) {
      try {
        return fromIpcError(JSON.parse(embedded))
      } catch (parseError) {
        return new AppError('INTERNAL', value.message, { parseError: String(parseError) })
      }
    }
    return new AppError('INTERNAL', value.message)
  }
  return new AppError('INTERNAL', typeof value === 'string' ? value : 'Unknown error')
}
