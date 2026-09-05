import { useEffect } from 'react'
import { create } from 'zustand'
import { nowIso } from '@shared/dates/instant'

export type NowPrecision = 'minute' | 'second'

interface TickerState {
  /** Updated every second while any `second` subscriber exists. */
  second: string
  /** Updated only when the wall-clock minute changes, so `minute` subscribers render once a minute. */
  minute: string
}

const initial = nowIso()
const useTicker = create<TickerState>(() => ({ second: initial, minute: initial }))

const subscribers = { minute: 0, second: 0 }
let timer: ReturnType<typeof setInterval> | undefined

const sameMinute = (a: string, b: string): boolean => a.slice(0, 16) === b.slice(0, 16)

const tick = (): void => {
  const next = nowIso()
  const { second, minute } = useTicker.getState()
  const patch: Partial<TickerState> = {}
  if (subscribers.second > 0 && next !== second) patch.second = next
  if (!sameMinute(next, minute)) {
    patch.minute = next
    patch.second = next
  }
  if (Object.keys(patch).length) useTicker.setState(patch)
}

const syncTimer = (): void => {
  const active = subscribers.minute + subscribers.second > 0
  if (active && timer === undefined) {
    const now = nowIso()
    useTicker.setState({ second: now, minute: now })
    timer = setInterval(tick, 1000)
  } else if (!active && timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

const subscribe = (precision: NowPrecision): (() => void) => {
  subscribers[precision] += 1
  syncTimer()
  return () => {
    subscribers[precision] -= 1
    syncTimer()
  }
}

/**
 * Current instant (ISO UTC) from one shared ticker with two slices: `second` subscribers
 * re-render every second, `minute` subscribers only when the minute changes — even while a
 * second-precision clock is mounted elsewhere. Pass `nowIso` explicitly to components under test
 * instead of mocking this hook.
 */
export const useNow = ({ precision = 'minute' }: { precision?: NowPrecision } = {}): string => {
  useEffect(() => subscribe(precision), [precision])
  return useTicker((state) => state[precision])
}

/** Latest ticked instant without subscribing (imperative code such as commands). */
export const getNow = (): string => useTicker.getState().second
