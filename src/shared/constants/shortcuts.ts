import type { PageId } from '../types/settings'

/** Commands that menu accelerators and keyboard shortcuts dispatch through the renderer's command dispatcher. */
export type AppCommandId =
  | 'openCommandPalette'
  | 'quickCreate'
  | 'importIcs'
  | 'openSettings'
  | 'goToPage'
  | 'calendarToday'
  | 'closeOverlay'

export interface Shortcut {
  id: string
  /** Key name as in `KeyboardEvent.key` (letters upper-case). */
  key: string
  /** `mod` = Cmd on macOS, Ctrl elsewhere. */
  modifier: 'mod' | 'none'
  command: AppCommandId
  args?: Record<string, string>
  description: string
  /** Where the shortcut is active. `calendar`: only when the Calendar page is focused and no input is active. */
  scope: 'global' | 'calendar' | 'overlay'
  /** Electron menu accelerator; `undefined` when the shortcut is handled only in the renderer. */
  accelerator?: string
}

export const PAGE_SHORTCUT_ORDER: readonly PageId[] = [
  'calendar',
  'deadlines',
  'timeline',
  'habits',
  'settings'
]

export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: 'command-palette',
    key: 'K',
    modifier: 'mod',
    command: 'openCommandPalette',
    description: 'Open the command palette',
    scope: 'global',
    accelerator: 'CommandOrControl+K'
  },
  {
    id: 'quick-create',
    key: 'N',
    modifier: 'mod',
    command: 'quickCreate',
    description: 'Create (context-aware)',
    scope: 'global',
    accelerator: 'CommandOrControl+N'
  },
  {
    id: 'import-ics',
    key: 'I',
    modifier: 'mod',
    command: 'importIcs',
    description: 'Import .ics files',
    scope: 'global',
    accelerator: 'CommandOrControl+I'
  },
  {
    id: 'settings',
    key: ',',
    modifier: 'mod',
    command: 'openSettings',
    description: 'Open Settings',
    scope: 'global',
    accelerator: 'CommandOrControl+,'
  },
  ...PAGE_SHORTCUT_ORDER.map((page, index): Shortcut => ({
    id: `page-${page}`,
    key: String(index + 1),
    modifier: 'mod',
    command: 'goToPage',
    args: { page },
    description: `Go to ${page.charAt(0).toUpperCase()}${page.slice(1)}`,
    scope: 'global',
    accelerator: `CommandOrControl+${index + 1}`
  })),
  {
    id: 'calendar-today',
    key: 'T',
    modifier: 'none',
    command: 'calendarToday',
    description: 'Go to today (Calendar)',
    scope: 'calendar'
  },
  {
    id: 'close-overlay',
    key: 'Escape',
    modifier: 'none',
    command: 'closeOverlay',
    description: 'Close the active modal or drawer',
    scope: 'overlay'
  }
]

/** Human-readable key combination, e.g. `⌘K` on macOS and `Ctrl+K` elsewhere. */
export const formatShortcut = (shortcut: Shortcut, platform: 'darwin' | 'other'): string => {
  const key = shortcut.key === 'Escape' ? 'Esc' : shortcut.key
  if (shortcut.modifier === 'none') return key
  return platform === 'darwin' ? `⌘${key}` : `Ctrl+${key}`
}
