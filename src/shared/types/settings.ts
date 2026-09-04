import type { CalendarViewId } from './calendar'
import type { IsoInstant } from './common'

export const PAGE_IDS = ['calendar', 'deadlines', 'timeline', 'habits', 'settings'] as const
export type PageId = (typeof PAGE_IDS)[number]

export const DATE_FORMATS = ['system', 'iso', 'dmy', 'mdy'] as const
export type DateFormatId = (typeof DATE_FORMATS)[number]

export const THEMES = ['light', 'dark', 'system'] as const
export type ThemeId = (typeof THEMES)[number]

export type ClockFormat = '12h' | '24h'
export type WeekStart = 0 | 1
export type LaunchPage = 'last' | 'calendar'

export interface AppSettings {
  /** `'system'` or any input accepted by `resolveZone` (IANA, `AoE`, `PT`, `UTC+8`, …). */
  timezone: 'system' | string
  dateFormat: DateFormatId
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: WeekStart
  clock: ClockFormat
  theme: ThemeId
  defaultCalendarView: CalendarViewId
  launchPage: LaunchPage
  subscriptionRefreshIntervalHours: number
  refreshOnLaunch: boolean
  requestTimeoutMs: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  timezone: 'system',
  dateFormat: 'system',
  weekStartsOn: 1,
  clock: '24h',
  theme: 'system',
  defaultCalendarView: 'timeGridWeek',
  launchPage: 'last',
  subscriptionRefreshIntervalHours: 6,
  refreshOnLaunch: true,
  requestTimeoutMs: 20000
}

export const DEADLINES_TABS = ['conference', 'personal'] as const
export type DeadlinesTab = (typeof DEADLINES_TABS)[number]

export const PERSONAL_DEADLINES_VIEWS = ['cards', 'list', 'timeline'] as const
export type PersonalDeadlinesView = (typeof PERSONAL_DEADLINES_VIEWS)[number]

export const TIMELINE_VIEWS = ['semester', 'year', 'multiYear', 'list'] as const
export type TimelineView = (typeof TIMELINE_VIEWS)[number]

export interface UiState {
  lastPage: PageId
  calendarView: CalendarViewId
  sidebarCollapsed: boolean
  deadlinesTab: DeadlinesTab
  personalDeadlinesView: PersonalDeadlinesView
  timelineView: TimelineView
}

export const DEFAULT_UI_STATE: UiState = {
  lastPage: 'calendar',
  calendarView: 'timeGridWeek',
  sidebarCollapsed: false,
  deadlinesTab: 'conference',
  personalDeadlinesView: 'cards',
  timelineView: 'semester'
}

export interface SettingsBundle {
  settings: AppSettings
  ui: UiState
}

export interface DismissedWarning {
  key: string
  dismissedAt: IsoInstant
  payload?: unknown
}
