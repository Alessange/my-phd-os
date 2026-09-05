import { Menu, type MenuItemConstructorOptions } from 'electron'
import { PAGE_SHORTCUT_ORDER, SHORTCUTS, type AppCommandId } from '@shared/constants/shortcuts'
import type { PageId } from '@shared/types/settings'
import { AppError } from '@shared/errors'

export interface MenuActions {
  /** Sends `app:command` to the focused window (dispatched by the renderer's command dispatcher). */
  sendCommand(command: AppCommandId, args?: Record<string, string>): void
  /** Sends `app:navigate` to the focused window. */
  navigate(page: PageId, params?: Record<string, string>): void
}

export interface MenuOptions {
  dev: boolean
  actions: MenuActions
}

const PAGE_LABELS: Record<PageId, string> = {
  calendar: 'Calendar',
  deadlines: 'Deadlines',
  timeline: 'Timeline',
  habits: 'Habits',
  settings: 'Settings'
}

const shortcut = (id: string): (typeof SHORTCUTS)[number] => {
  const found = SHORTCUTS.find((s) => s.id === id)
  if (!found) throw new AppError('INTERNAL', `Unknown shortcut "${id}"`, { id })
  return found
}

const commandItem = (
  actions: MenuActions,
  shortcutId: string,
  label: string
): MenuItemConstructorOptions => {
  const s = shortcut(shortcutId)
  return { label, accelerator: s.accelerator, click: () => actions.sendCommand(s.command, s.args) }
}

export const buildMenuTemplate = ({ dev, actions }: MenuOptions): MenuItemConstructorOptions[] => {
  const isMac = process.platform === 'darwin'
  const settingsItem = commandItem(actions, 'settings', 'Settings…')
  const aboutItem: MenuItemConstructorOptions = {
    label: 'About My PhD OS',
    click: () => actions.navigate('settings', { section: 'about' })
  }

  const appMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: 'My PhD OS',
          submenu: [
            aboutItem,
            { type: 'separator' },
            settingsItem,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }
      ]
    : []

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      commandItem(actions, 'quick-create', 'New…'),
      commandItem(actions, 'import-ics', 'Import .ics…'),
      { type: 'separator' },
      ...(isMac ? [] : [settingsItem, { type: 'separator' } as MenuItemConstructorOptions]),
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  }

  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
      { type: 'separator' },
      commandItem(actions, 'command-palette', 'Command Palette…')
    ]
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      ...(dev
        ? ([
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' }
          ] as MenuItemConstructorOptions[])
        : []),
      ...PAGE_SHORTCUT_ORDER.map((page) => commandItem(actions, `page-${page}`, PAGE_LABELS[page])),
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }

  const windowMenu: MenuItemConstructorOptions = {
    label: 'Window',
    submenu: isMac
      ? [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ]
      : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }]
  }

  const helpMenu: MenuItemConstructorOptions = {
    role: 'help',
    submenu: [aboutItem]
  }

  return [...appMenu, fileMenu, editMenu, viewMenu, windowMenu, helpMenu]
}

export const installAppMenu = (options: MenuOptions): Menu => {
  const menu = Menu.buildFromTemplate(buildMenuTemplate(options))
  Menu.setApplicationMenu(menu)
  return menu
}
