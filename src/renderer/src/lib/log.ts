import type { LogRequest } from '@shared/schemas/app'
import { api } from './api'

type LogContext = NonNullable<LogRequest['context']>
type LogValue = LogContext[string]

const MAX_MESSAGE_CHARS = 500
const MAX_KEYS = 20

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max)}… [${value.length} chars]` : value

/**
 * Reduces caller context to what `app:log` accepts (≤ 20 keys, primitives only, strings ≤ 500
 * chars). Objects are replaced by a type marker: the log must never receive whole records.
 */
export const toLogContext = (context: Record<string, unknown> | undefined): LogContext => {
  const safe: LogContext = {}
  for (const [key, value] of Object.entries(context ?? {}).slice(0, MAX_KEYS)) {
    let out: LogValue | undefined
    if (typeof value === 'string') out = truncate(value, MAX_MESSAGE_CHARS)
    else if (value === null || typeof value === 'number' || typeof value === 'boolean') out = value
    else if (value !== undefined)
      out = Array.isArray(value) ? `[${value.length} items]` : `[object]`
    if (out !== undefined) safe[key.slice(0, 64)] = out
  }
  return safe
}

/**
 * Reports a renderer-side failure to the local main-process log (electron-log) and the console.
 * Used where a toast would be noise (e.g. persisting the last visited page). Never swallows: the
 * console always receives the full error, while the log receives only `error.name`, a truncated
 * `error.message` and bounded primitive context (spec §22: no sensitive content stored needlessly).
 */
export const logError = (
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void => {
  const detail =
    error instanceof Error
      ? { errorName: error.name, errorMessage: error.message }
      : { error: String(error) }
  console.error(message, error)
  // `toLogContext` truncates every string once (error message included).
  api('app:log', {
    level: 'error',
    message: truncate(message, MAX_MESSAGE_CHARS),
    context: toLogContext({ ...context, ...detail })
  }).catch((logFailure: unknown) =>
    console.error('Could not write to the application log', logFailure)
  )
}
