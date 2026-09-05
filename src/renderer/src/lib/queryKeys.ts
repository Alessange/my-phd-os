import type { EntityName } from '@shared/ipc/events'

/** All TanStack Query keys. Feature hooks build on these; never invent keys elsewhere. */
export const queryKeys = {
  app: {
    all: ['app'] as const,
    info: () => ['app', 'info'] as const
  },
  settings: {
    all: ['settings'] as const,
    bundle: () => ['settings', 'bundle'] as const,
    dismissedWarnings: () => ['settings', 'dismissedWarnings'] as const
  },
  calendar: {
    all: ['calendar'] as const,
    events: (filter?: unknown) => ['calendar', 'events', filter ?? {}] as const,
    event: (id: string) => ['calendar', 'event', id] as const,
    sources: () => ['calendar', 'sources'] as const
  },
  personalDeadlines: {
    all: ['personalDeadlines'] as const,
    list: (filter?: unknown) => ['personalDeadlines', 'list', filter ?? {}] as const,
    detail: (id: string) => ['personalDeadlines', 'detail', id] as const
  },
  conferences: {
    all: ['conferences'] as const,
    subscriptions: () => ['conferences', 'subscriptions'] as const,
    refreshStatus: () => ['conferences', 'refreshStatus'] as const,
    deadlines: (filter?: unknown) => ['conferences', 'deadlines', filter ?? {}] as const,
    deadline: (id: string) => ['conferences', 'deadline', id] as const,
    followed: () => ['conferences', 'followed'] as const,
    changes: (filter?: unknown) => ['conferences', 'changes', filter ?? {}] as const
  },
  milestones: {
    all: ['milestones'] as const,
    list: () => ['milestones', 'list'] as const,
    detail: (id: string) => ['milestones', 'detail', id] as const
  },
  habits: {
    all: ['habits'] as const,
    list: (filter?: unknown) => ['habits', 'list', filter ?? {}] as const,
    detail: (id: string) => ['habits', 'detail', id] as const,
    completions: (filter?: unknown) => ['habits', 'completions', filter ?? {}] as const
  },
  data: {
    all: ['data'] as const,
    storageInfo: () => ['data', 'storageInfo'] as const
  }
} as const

export type QueryKeyPrefix = readonly unknown[]

/** Which key prefixes to invalidate when `data:changed` names an entity. */
export const ENTITY_INVALIDATION: Readonly<Record<EntityName, readonly QueryKeyPrefix[]>> = {
  calendarEvents: [queryKeys.calendar.all, queryKeys.data.all],
  calendarSources: [queryKeys.calendar.all, queryKeys.data.all],
  personalDeadlines: [queryKeys.personalDeadlines.all, queryKeys.calendar.all, queryKeys.data.all],
  conferenceSubscriptions: [queryKeys.conferences.all, queryKeys.data.all],
  conferenceDeadlines: [queryKeys.conferences.all, queryKeys.calendar.all, queryKeys.data.all],
  followedConferences: [queryKeys.conferences.all, queryKeys.calendar.all, queryKeys.data.all],
  conferenceChanges: [queryKeys.conferences.all, queryKeys.data.all],
  milestones: [queryKeys.milestones.all, queryKeys.data.all],
  habits: [queryKeys.habits.all, queryKeys.data.all],
  habitCompletions: [queryKeys.habits.all, queryKeys.data.all],
  settings: [queryKeys.settings.all],
  dismissedWarnings: [queryKeys.settings.all]
}
