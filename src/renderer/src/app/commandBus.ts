/**
 * Tiny synchronous bus for named commands that features subscribe to. The shell dispatches
 * (`shortcuts.ts`, palette, menu); features subscribe with `useCommandListener` or `subscribeCommand`.
 */
import { useEffect } from 'react'

/** Shell commands are fixed names; features add their own as `<feature>:<verb>` (ARCHITECTURE §7). */
export type ShellCommandName = 'import-ics' | 'calendar-today' | 'close-overlay' | 'quick-create'
export type FeatureCommandName = `${string}:${string}`
export type BusCommandName = ShellCommandName | FeatureCommandName

export type BusCommandArgs = Record<string, string>
type Listener = (args: BusCommandArgs) => void

const listeners = new Map<BusCommandName, Set<Listener>>()

/** How long a deferred command waits for its page to mount before it is dropped as stale. */
const DEFERRED_TTL_MS = 3000
const deferred = new Map<BusCommandName, { args: BusCommandArgs; at: number }>()

export const subscribeCommand = (name: BusCommandName, listener: Listener): (() => void) => {
  const set = listeners.get(name) ?? new Set<Listener>()
  set.add(listener)
  listeners.set(name, set)
  // A command sent while nobody listened (see `dispatchCommandWhenMounted`) is delivered once, to the first subscriber.
  const waiting = deferred.get(name)
  if (waiting) {
    deferred.delete(name)
    if (Date.now() - waiting.at <= DEFERRED_TTL_MS) listener(waiting.args)
  }
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

/**
 * For "navigate there, then do X" commands: dispatches now if the target page is already mounted,
 * otherwise keeps the latest call per name and hands it to the first subscriber that mounts within
 * a few seconds. Plain `dispatchCommand` stays fire-and-forget (its 0 result is a fallback signal).
 */
export const dispatchCommandWhenMounted = (
  name: BusCommandName,
  args: BusCommandArgs = {}
): void => {
  if (dispatchCommand(name, args) === 0) deferred.set(name, { args, at: Date.now() })
}

export const useCommandListener = (name: BusCommandName, listener: Listener): void => {
  useEffect(() => subscribeCommand(name, listener), [name, listener])
}
