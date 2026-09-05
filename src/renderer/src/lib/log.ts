import { api } from './api'

/**
 * Reports a renderer-side failure to the local main-process log (electron-log) and the console.
 * Used where a toast would be noise (e.g. persisting the last visited page). Never swallows: the
 * console always receives the error, even when the log channel itself is unavailable.
 */
export const logError = (
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void => {
  const detail = error instanceof Error ? { name: error.name, message: error.message } : { error }
  console.error(message, error)
  api('app:log', { level: 'error', message, context: { ...context, ...detail } }).catch(
    (logFailure: unknown) => console.error('Could not write to the application log', logFailure)
  )
}
