import {
  CalendarCheck,
  Import,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  Sun,
  type LucideIcon
} from 'lucide-react'
import { useMemo } from 'react'
import { create } from 'zustand'
import type { PageId, ThemeId } from '@shared/types/settings'
import { persistSettings } from '@renderer/hooks/useSettings'
import { calendarCommands } from '@renderer/features/calendar/commands'
import { conferenceDeadlineCommands } from '@renderer/features/conference-deadlines/commands'
import { habitCommands } from '@renderer/features/habits/commands'
import { personalDeadlineCommands } from '@renderer/features/personal-deadlines/commands'
import { settingsCommands } from '@renderer/features/settings/commands'
import { timelineCommands } from '@renderer/features/timeline/commands'
import { dispatchCommand } from './commandBus'
import { PAGES, useNavigation, type NavigationParams } from './navigation'
import { triggerQuickCreate } from './quickCreate'
import { useShell } from './shell'

export interface CommandContext {
  page: PageId
  navigate: (page: PageId, params?: NavigationParams) => void
  /** Closes the palette (already called after `run`; useful before opening another dialog). */
  close: () => void
}

export interface Command {
  id: string
  title: string
  /** Palette section heading: `Navigate`, `Create`, `Calendar`, `Appearance`, `Settings`, … */
  group: string
  keywords?: string[]
  /** `mod+K` style; rendered per platform. */
  shortcut?: string
  icon?: LucideIcon
  /** Hide the command in some contexts (e.g. only on the Calendar page). */
  when?: (ctx: Pick<CommandContext, 'page'>) => boolean
  run: (ctx: CommandContext) => void | Promise<void>
}

interface PaletteState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCommandPalette = create<PaletteState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open })
}))

export const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'subscriptions', label: 'Conference Subscriptions' },
  { id: 'data', label: 'Data' },
  { id: 'about', label: 'About' }
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

const THEME_COMMANDS: { theme: ThemeId; title: string; icon: LucideIcon }[] = [
  { theme: 'light', title: 'Use light theme', icon: Sun },
  { theme: 'dark', title: 'Use dark theme', icon: Moon },
  { theme: 'system', title: 'Follow system theme', icon: Monitor }
]

export const shellCommands: Command[] = [
  ...PAGES.map((page): Command => ({
    id: `navigate:${page.id}`,
    title: `Go to ${page.label}`,
    group: 'Navigate',
    keywords: ['open', 'page', page.label.toLowerCase()],
    shortcut: `mod+${page.shortcutIndex}`,
    icon: page.icon,
    run: (ctx) => ctx.navigate(page.id)
  })),
  {
    id: 'quick-create',
    title: 'Create…',
    group: 'Create',
    keywords: ['new', 'add', 'event', 'deadline', 'milestone', 'habit'],
    shortcut: 'mod+N',
    icon: Plus,
    run: () => triggerQuickCreate()
  },
  {
    id: 'import-ics',
    title: 'Import .ics files',
    group: 'Calendar',
    keywords: ['calendar', 'ical', 'import', 'file'],
    shortcut: 'mod+I',
    icon: Import,
    run: (ctx) => {
      ctx.navigate('calendar')
      dispatchCommand('import-ics')
    }
  },
  {
    id: 'calendar-today',
    title: 'Go to today',
    group: 'Calendar',
    keywords: ['calendar', 'now', 'today'],
    shortcut: 'T',
    icon: CalendarCheck,
    when: ({ page }) => page === 'calendar',
    run: () => {
      dispatchCommand('calendar-today')
    }
  },
  ...THEME_COMMANDS.map(({ theme, title, icon }): Command => ({
    id: `theme:${theme}`,
    title,
    group: 'Appearance',
    keywords: ['theme', 'appearance', 'mode', theme],
    icon,
    run: () => void persistSettings({ theme })
  })),
  {
    id: 'toggle-sidebar',
    title: 'Toggle sidebar',
    group: 'Appearance',
    keywords: ['collapse', 'expand', 'navigation', 'layout'],
    icon: PanelLeft,
    run: () => useShell.getState().toggleSidebar()
  },
  ...SETTINGS_SECTIONS.map(({ id, label }): Command => ({
    id: `settings:${id}`,
    title: `Settings: ${label}`,
    group: 'Settings',
    keywords: ['settings', 'preferences', label.toLowerCase()],
    shortcut: id === 'general' ? 'mod+,' : undefined,
    run: (ctx) => ctx.navigate('settings', { section: id })
  }))
]

const featureCommands: Command[] = [
  ...calendarCommands,
  ...conferenceDeadlineCommands,
  ...personalDeadlineCommands,
  ...timelineCommands,
  ...habitCommands,
  ...settingsCommands
]

/** Shell commands merged with every feature's `commands.ts`, filtered by the current page. */
export const useCommands = (): Command[] => {
  const page = useNavigation((state) => state.page)
  return useMemo(
    () =>
      [...shellCommands, ...featureCommands].filter((command) => command.when?.({ page }) ?? true),
    [page]
  )
}

export const groupCommands = (commands: Command[]): [string, Command[]][] => {
  const groups = new Map<string, Command[]>()
  commands.forEach((command) => {
    const list = groups.get(command.group) ?? []
    list.push(command)
    groups.set(command.group, list)
  })
  return [...groups.entries()]
}
