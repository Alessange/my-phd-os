import { useEffect } from 'react'
import { create } from 'zustand'
import { nowIso } from '@shared/dates/instant'

export type NowPrecision = 'minute' | 'second'

interface TickerState {
  nowIso: string
}

const useTicker = create<TickerState>(() => ({ nowIso: nowIso() }))

const subscribers = { minute: 0, second: 0 }
let timer: ReturnType<typeof setInterval> | undefined

const tick = (): void => {
  const next = nowIso()
  const current = useTicker.getState().nowIso
  const minuteChanged = next.slice(0, 16) !== current.slice(0, 16)
  if (subscribers.second > 0 || minuteChanged) useTicker.setState({ nowIso: next })
}

const syncTimer = (): void => {
  const active = subscribers.minute + subscribers.second > 0
  if (active && timer === undefined) {
    useTicker.setState({ nowIso: nowIso() })
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
 * Current instant (ISO UTC) from one shared ticker. The store updates every second while any
 * subscriber asks for `second` precision, otherwise once per minute. Pass `nowIso` explicitly to
 * components under test instead of mocking this hook.
 */
export const useNow = ({ precision = 'minute' }: { precision?: NowPrecision } = {}): string => {
  useEffect(() => subscribe(precision), [precision])
  return useTicker((state) => state.nowIso)
}

export const getNow = (): string => useTicker.getState().nowIso
