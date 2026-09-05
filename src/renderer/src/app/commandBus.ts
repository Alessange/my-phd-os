/**
 * Tiny synchronous bus for named commands that features subscribe to. The shell dispatches
 * (`shortcuts.ts`, palette, menu); features subscribe with `useCommandListener` or `subscribeCommand`.
 */
import { useEffect } from 'react'

export type BusCommandName = 'import-ics' | 'calendar-today' | 'close-overlay' | 'quick-create'

export type BusCommandArgs = Record<string, string>
type Listener = (args: BusCommandArgs) => void

const listeners = new Map<BusCommandName, Set<Listener>>()

export const subscribeCommand = (name: BusCommandName, listener: Listener): (() => void) => {
  const set = listeners.get(name) ?? new Set<Listener>()
  set.add(listener)
  listeners.set(name, set)
  return () => {
    set.delete(listener)
  }
}

/** Dispatches to every subscriber; returns how many were notified so callers can fall back. */
export const dispatchCommand = (name: BusCommandName, args: BusCommandArgs = {}): number => {
  const set = listeners.get(name)
  if (!set || set.size === 0) return 0
  set.forEach((listener) => listener(args))
  return set.size
}

export const useCommandListener = (name: BusCommandName, listener: Listener): void => {
  useEffect(() => subscribeCommand(name, listener), [name, listener])
}
