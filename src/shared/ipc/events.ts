import type { AppCommandId } from '../constants/shortcuts'
import type { RefreshStatus } from '../types/conference'
import type { PageId } from '../types/settings'

/** Persisted entities. `data:changed` names the ones a mutation touched. */
export const ENTITY_NAMES = [
  'calendarEvents',
  'calendarSources',
  'personalDeadlines',
  'conferenceSubscriptions',
  'conferenceDeadlines',
  'followedConferences',
  'conferenceChanges',
  'milestones',
  'habits',
  'habitCompletions',
  'settings',
  'dismissedWarnings'
] as const
export type EntityName = (typeof ENTITY_NAMES)[number]

export const isEntityName = (value: unknown): value is EntityName =>
  typeof value === 'string' && (ENTITY_NAMES as readonly string[]).includes(value)

/** Main → renderer push events and their payloads. */
export interface EventPayloads {
  'data:changed': { entities: EntityName[] }
  'conferences:refreshStatus': RefreshStatus
  'app:command': { command: AppCommandId; args?: Record<string, string> }
  'app:navigate': { page: PageId; params?: Record<string, string> }
}

export const EVENT_NAMES = [
  'data:changed',
  'conferences:refreshStatus',
  'app:command',
  'app:navigate'
] as const satisfies readonly (keyof EventPayloads)[]

export type EventName = keyof EventPayloads
export type EventPayload<E extends EventName> = EventPayloads[E]

export const isEventName = (value: unknown): value is EventName =>
  typeof value === 'string' && (EVENT_NAMES as readonly string[]).includes(value)
