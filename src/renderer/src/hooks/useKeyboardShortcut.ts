import { useEffect } from 'react'
import { isEditableTarget } from '@renderer/lib/utils'
import { getPlatform } from './usePlatform'

export interface KeyboardShortcutOptions {
  /** Require the platform modifier (⌘ on macOS, Ctrl elsewhere). */
  mod?: boolean
  shift?: boolean
  /** Ignore the shortcut while typing in an input, textarea or contenteditable (default `true` for unmodified keys). */
  ignoreInEditable?: boolean
  enabled?: boolean
}

/** Matches a `KeyboardEvent` against a key + modifier description. Exported for the global dispatcher. */
export const matchesShortcut = (
  event: KeyboardEvent,
  key: string,
  options: Pick<KeyboardShortcutOptions, 'mod' | 'shift'> = {}
): boolean => {
  const { isMac } = getPlatform()
  const modPressed = isMac ? event.metaKey : event.ctrlKey
  const otherModPressed = isMac ? event.ctrlKey : event.metaKey
  if (Boolean(options.mod) !== modPressed || otherModPressed || event.altKey) return false
  if (Boolean(options.shift) !== event.shiftKey) return false
  return event.key.toUpperCase() === key.toUpperCase()
}

/** Feature-level shortcut hook. Global shortcuts live in `app/shortcuts.ts`; do not duplicate them here. */
export const useKeyboardShortcut = (
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: KeyboardShortcutOptions = {}
): void => {
  const { mod = false, shift = false, ignoreInEditable = !mod, enabled = true } = options
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return
      if (ignoreInEditable && isEditableTarget(event.target)) return
      if (!matchesShortcut(event, key, { mod, shift })) return
      event.preventDefault()
      handler(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, handler, mod, shift, ignoreInEditable, enabled])
}
