import { CalendarDays, Repeat, Route, Settings, Timer, type LucideIcon } from 'lucide-react'
import { create } from 'zustand'
import type { LaunchPage, PageId } from '@shared/types/settings'
import { persistUi } from '@renderer/hooks/useSettings'

export type NavigationParams = Record<string, string>

export interface PageDefinition {
  id: PageId
  label: string
  icon: LucideIcon
  /** 1-based index used by the `mod+1…5` shortcuts. */
  shortcutIndex: number
  /** Noun for the quick-create button (`New Event`); undefined when the page creates nothing. */
  createLabel?: string
}

/** Sidebar order is fixed by the spec (§1). */
export const PAGES: readonly PageDefinition[] = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, shortcutIndex: 1, createLabel: 'Event' },
  { id: 'deadlines', label: 'Deadlines', icon: Timer, shortcutIndex: 2, createLabel: 'Deadline' },
  { id: 'timeline', label: 'Timeline', icon: Route, shortcutIndex: 3, createLabel: 'Milestone' },
  { id: 'habits', label: 'Habits', icon: Repeat, shortcutIndex: 4, createLabel: 'Habit' },
  { id: 'settings', label: 'Settings', icon: Settings, shortcutIndex: 5 }
]

export const getPage = (id: PageId): PageDefinition =>
  PAGES.find((page) => page.id === id) ?? PAGES[0]

export const isPageId = (value: unknown): value is PageId =>
  typeof value === 'string' && PAGES.some((page) => page.id === value)

export interface NavigationState {
  page: PageId
  params: NavigationParams
  /** True once the persisted `lastPage` has been applied; navigation persists only after that. */
  hydrated: boolean
  navigate: (page: PageId, params?: NavigationParams) => void
  /** Applies persisted UI state exactly once, honouring the launch-page preference. */
  hydrate: (lastPage: PageId, launchPage: LaunchPage) => void
  back: () => void
}

const MAX_HISTORY = 20

export const useNavigation = create<NavigationState>((set, get) => {
  const history: PageId[] = []
  return {
    page: 'calendar',
    params: {},
    hydrated: false,
    navigate: (page, params = {}) => {
      const { page: current, hydrated } = get()
      if (current !== page) {
        history.push(current)
        if (history.length > MAX_HISTORY) history.shift()
      }
      set({ page, params })
      if (hydrated && current !== page) void persistUi({ lastPage: page })
    },
    hydrate: (lastPage, launchPage) => {
      if (get().hydrated) return
      set({ page: launchPage === 'calendar' ? 'calendar' : lastPage, hydrated: true })
    },
    back: () => {
      const previous = history.pop()
      if (previous) get().navigate(previous)
    }
  }
})

/** Imperative navigation for non-React code (commands, menu events). */
export const navigate = (page: PageId, params?: NavigationParams): void =>
  useNavigation.getState().navigate(page, params)
