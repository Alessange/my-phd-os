export interface EmptyStateCopy {
  title: string
  description?: string
  actions: readonly string[]
}

/** Exact empty-state strings from ARCHITECTURE §10 / spec §19. */
export const EMPTY_STATES = {
  calendar: {
    title: 'Your calendar is empty.',
    actions: ['Import .ics', 'Create event']
  },
  // The Deadlines tab leads with "Add conference" (CREATE_LABELS) and uses only actions[1] from
  // here; actions[0] is the Subscription Manager's empty-state action.
  conferenceDeadlinesNoSubscription: {
    title: 'No conference subscription yet.',
    actions: ['Add CCF subscription', 'Enter subscription URL']
  },
  conferenceDeadlinesNotLoaded: {
    title: 'Conference deadlines have not loaded yet.',
    description: 'Your subscription exists but no snapshot has been retrieved.',
    actions: ['Retry']
  },
  personalDeadlines: {
    title: 'No personal deadlines yet.',
    description: 'Countdowns and progress tracking appear after you add a deadline.',
    actions: ['Add personal deadline']
  },
  timeline: {
    title: 'Your timeline starts here.',
    actions: ['Add milestone']
  },
  habits: {
    title: 'No habits yet.',
    actions: ['Create habit']
  },
  todayEvents: { title: 'Nothing scheduled today.', actions: [] },
  nextEvent: { title: 'No upcoming event.', actions: [] },
  nearestDeadline: { title: 'No active deadline.', actions: [] },
  todayHabits: { title: 'No habits for today.', actions: [] }
} as const satisfies Record<string, EmptyStateCopy>

export type EmptyStateId = keyof typeof EMPTY_STATES
