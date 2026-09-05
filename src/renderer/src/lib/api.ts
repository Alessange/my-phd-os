import { AppError, fromIpcError, type AppErrorCode } from '@shared/errors'
import type { ChannelName, InvokeArgs, ResponseOf, WindowApi } from '@shared/ipc/contract'
import type { EventName, EventPayload } from '@shared/ipc/events'

/**
 * The only module that touches `window.api` (typed globally by `src/preload/index.d.ts`). The
 * guard keeps a page opened without the preload (a misconfigured build) failing loudly.
 */
const bridge = (): WindowApi => {
  const api = window.api as WindowApi | undefined
  if (!api) throw new AppError('INTERNAL', 'The preload bridge (window.api) is not available')
  return api
}

/** An `AppError` that also records which channel failed, for toasts and logs. */
export class ApiError extends AppError {
  readonly channel: ChannelName

  constructor(channel: ChannelName, code: AppErrorCode, message: string, details?: unknown) {
    super(code, message, details)
    this.name = 'ApiError'
    this.channel = channel
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

/** Typed IPC call. Rejections arrive as `ApiError` (an `AppError` with the channel attached). */
export const api = async <N extends ChannelName>(
  channel: N,
  ...args: InvokeArgs<N>
): Promise<ResponseOf<N>> => {
  try {
    return await bridge().invoke(channel, ...args)
  } catch (error) {
    const appError = fromIpcError(error)
    throw new ApiError(channel, appError.code, appError.message, appError.details)
  }
}

/** Subscribes to a main → renderer push event. Returns the unsubscribe function. */
export const onEvent = <E extends EventName>(
  event: E,
  listener: (payload: EventPayload<E>) => void
): (() => void) => bridge().on(event, listener)
