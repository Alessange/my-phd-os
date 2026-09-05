/**
 * Shortcut strings used by commands and hints: `mod+K`, `mod+,`, `mod+1`, `T`, `Escape`.
 * `mod` is ⌘ on macOS and Ctrl elsewhere.
 */
export const shortcutKeys = (shortcut: string, isMac: boolean): string[] =>
  shortcut.split('+').map((part) => {
    switch (part.toLowerCase()) {
      case 'mod':
        return isMac ? '⌘' : 'Ctrl'
      case 'shift':
        return isMac ? '⇧' : 'Shift'
      case 'alt':
        return isMac ? '⌥' : 'Alt'
      case 'escape':
        return 'Esc'
      case 'enter':
        return isMac ? '↩' : 'Enter'
      default:
        return part.length === 1 ? part.toUpperCase() : part
    }
  })

export const formatShortcutLabel = (shortcut: string, isMac: boolean): string => {
  const keys = shortcutKeys(shortcut, isMac)
  return isMac ? keys.join('') : keys.join('+')
}
