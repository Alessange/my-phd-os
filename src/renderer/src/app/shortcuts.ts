import { useEffect } from 'react'
import { SHORTCUTS, type AppCommandId, type Shortcut } from '@shared/constants/shortcuts'
import { onEvent } from '@renderer/lib/api'
import { isEditableTarget } from '@renderer/lib/utils'
import { getPlatform } from '@renderer/hooks/usePlatform'
import { dispatchCommand } from './commandBus'
import { useCommandPalette } from './commands'
import { isPageId, useNavigation } from './navigation'
import { triggerQuickCreate } from './quickCreate'

/** Single entry point for menu accelerators (`app:command`), keyboard shortcuts and the palette. */
export const runAppCommand = (command: AppCommandId, args: Record<string, string> = {}): void => {
  const { navigate, page } = useNavigation.getState()
  const palette = useCommandPalette.getState()
  switch (command) {
    case 'openCommandPalette':
      palette.toggle()
      return
    case 'quickCreate':
      triggerQuickCreate()
      return
    case 'importIcs':
      navigate('calendar')
      dispatchCommand('import-ics')
      return
    case 'openSettings':
      navigate('settings', args.section ? { section: args.section } : {})
      return
    case 'goToPage':
      if (isPageId(args.page)) navigate(args.page)
      return
    case 'calendarToday':
      if (page !== 'calendar') navigate('calendar')
      dispatchCommand('calendar-today')
      return
    case 'closeOverlay':
      if (palette.open) palette.setOpen(false)
      else dispatchCommand('close-overlay')
      return
  }
}

const modifierPressed = (event: KeyboardEvent): boolean =>
  getPlatform().isMac ? event.metaKey : event.ctrlKey

const matches = (shortcut: Shortcut, event: KeyboardEvent): boolean => {
  if (event.altKey || event.shiftKey) return false
  if (shortcut.modifier === 'mod' && !modifierPressed(event)) return false
  if (shortcut.modifier === 'none' && (event.metaKey || event.ctrlKey)) return false
  return event.key.toUpperCase() === shortcut.key.toUpperCase()
}

/** Resolves a keydown to a shared shortcut, honouring scope rules (§7). Exported for tests. */
export const resolveShortcut = (
  event: KeyboardEvent,
  context: { page: string; paletteOpen: boolean }
): Shortcut | undefined =>
  SHORTCUTS.find((shortcut) => {
    if (!matches(shortcut, event)) return false
    if (shortcut.scope === 'calendar')
      return context.page === 'calendar' && !isEditableTarget(event.target) && !context.paletteOpen
    return true
  })

export const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.defaultPrevented || event.repeat) return
  const shortcut = resolveShortcut(event, {
    page: useNavigation.getState().page,
    paletteOpen: useCommandPalette.getState().open
  })
  if (!shortcut) return
  if (shortcut.command === 'closeOverlay') {
    // Radix layers close themselves on Esc; the dispatcher only handles the palette and bus subscribers.
    if (!useCommandPalette.getState().open && dispatchCommand('close-overlay') === 0) return
    event.preventDefault()
    if (useCommandPalette.getState().open) useCommandPalette.getState().setOpen(false)
    return
  }
  event.preventDefault()
  runAppCommand(shortcut.command, shortcut.args)
}

/** Mounts the keyboard dispatcher plus the `app:command` and `app:navigate` bridges. Mount once in `App`. */
export const useGlobalShortcuts = (): void => {
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    const offCommand = onEvent('app:command', ({ command, args }) => runAppCommand(command, args))
    const offNavigate = onEvent('app:navigate', ({ page, params }) =>
      useNavigation.getState().navigate(page, params)
    )
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      offCommand()
      offNavigate()
    }
  }, [])
}
