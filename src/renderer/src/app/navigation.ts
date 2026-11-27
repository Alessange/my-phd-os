import { CalendarDays, Repeat, Route, Settings, Timer, type LucideIcon } from 'lucide-react'
import { create } from 'zustand'
import type { DeadlinesTab, LaunchPage, PageId } from '@shared/types/settings'
import { persistUi } from '@renderer/hooks/useSettings'

export type NavigationParams = Record<string, string>

/**
 * The one source of the create-action names: the strip's primary button, the page's own button
 * and the palette's `Create` group all read these, so one action never carries two spellings.
 * Sentence case throughout (DESIGN.md 7).
 */
export const CREATE_LABELS = {
  event: 'Add event',
  conference: 'Add conference',
  personalDeadline: 'Add personal deadline',
  milestone: 'Add milestone',
  habit: 'Create habit'
} as const

export interface PageDefinition {
  id: PageId
  label: string
  icon: LucideIcon
  /** 1-based index used by the `mod+1…5` shortcuts. */
  shortcutIndex: number
  /** Noun for what quick-create makes (`event`); undefined when the page creates nothing. */
  createLabel?: string
  /**
   * Label of the top-bar quick-create button. Uses the same verb as the page's own toolbar
   * (`Add event`, `Add milestone` / `Create habit`) so one action never carries two
   * names on screen.
   */
  createActionLabel?: string
}

/** Sidebar order is fixed by the spec (§1). */
export const PAGES: readonly PageDefinition[] = [
  {
    id: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    shortcutIndex: 1,
    createLabel: 'Event',
    createActionLabel: CREATE_LABELS.event
  },
  {
    id: 'deadlines',
    label: 'Deadlines',
    icon: Timer,
    shortcutIndex: 2,
    createLabel: 'Deadline',
    createActionLabel: 'Add deadline'
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: Route,
    shortcutIndex: 3,
    createLabel: 'Milestone',
    createActionLabel: CREATE_LABELS.milestone
  },
  {
    id: 'habits',
    label: 'Habits',
    icon: Repeat,
    shortcutIndex: 4,
    createLabel: 'Habit',
    createActionLabel: CREATE_LABELS.habit
  },
  { id: 'settings', label: 'Settings', icon: Settings, shortcutIndex: 5 }
]

export interface CreateAction {
  /**
   * Visible label of the primary create button in the top strip. Its accessible name is this text
   * plus the shortcut (`Add conference (⌘N)`), so the visible text is contained in the name
   * (WCAG 2.5.3 Label in Name).
   */
  label: string
}

/**
 * What the strip's primary button creates on a page. On Deadlines the label follows the active tab
 * (`Add conference` / `Add personal deadline`): one action, one name, no ambiguity (DESIGN.md 7).
 */
export const resolveCreateAction = (
  page: PageDefinition,
  deadlinesTab?: DeadlinesTab
): CreateAction | undefined => {
  if (page.id === 'deadlines') {
    return deadlinesTab === 'personal'
      ? { label: CREATE_LABELS.personalDeadline }
      : { label: CREATE_LABELS.conference }
  }
  if (!page.createLabel || !page.createActionLabel) return undefined
  return { label: page.createActionLabel }
}

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
