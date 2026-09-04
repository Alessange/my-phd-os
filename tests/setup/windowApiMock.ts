import { vi, type Mock } from 'vitest'
import { AppError } from '../../src/shared/errors'
import type { ChannelName, ResponseOf, WindowApi } from '../../src/shared/ipc/contract'
import type { EventName, EventPayload } from '../../src/shared/ipc/events'

type Listener = (payload: unknown) => void

/**
 * Minimal `window.api` stand-in for renderer tests. Register responses with `respond`, push events
 * with `emit`, and inspect calls through `invoke.mock`. Unregistered channels reject with
 * `AppError('NOT_IMPLEMENTED')` so a test never silently passes on missing data.
 */
export interface WindowApiMock extends WindowApi {
  invoke: Mock<WindowApi['invoke']>
  respond<N extends ChannelName>(
    channel: N,
    handler: ResponseOf<N> | ((payload: unknown) => ResponseOf<N> | Promise<ResponseOf<N>>)
  ): void
  emit<E extends EventName>(event: E, payload: EventPayload<E>): void
  reset(): void
}

export const createWindowApiMock = (): WindowApiMock => {
  const responders = new Map<string, (payload: unknown) => unknown>()
  const listeners = new Map<string, Set<Listener>>()

  const invoke = vi.fn(async (channel: string, payload?: unknown) => {
    const responder = responders.get(channel)
    if (!responder)
      throw new AppError('NOT_IMPLEMENTED', `No mock response registered for "${channel}"`)
    return responder(payload)
  }) as unknown as WindowApiMock['invoke']

  const on: WindowApi['on'] = (event, listener) => {
    const set = listeners.get(event) ?? new Set()
    set.add(listener as Listener)
    listeners.set(event, set)
    return () => set.delete(listener as Listener)
  }

  const off: WindowApi['off'] = (event, listener) => {
    listeners.get(event)?.delete(listener as Listener)
  }

  return {
    invoke,
    on,
    off,
    respond: (channel, handler) => {
      responders.set(
        channel,
        typeof handler === 'function' ? (handler as (p: unknown) => unknown) : () => handler
      )
    },
    emit: (event, payload) => {
      listeners.get(event)?.forEach((listener) => listener(payload))
    },
    reset: () => {
      responders.clear()
      listeners.clear()
      invoke.mockClear()
    }
  }
}
