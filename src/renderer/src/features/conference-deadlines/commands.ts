import { CalendarClock, RefreshCw, Rss } from 'lucide-react'
import type { RefreshOutcome } from '@shared/types/conference'
import type { Command } from '@renderer/app/commands'
import { api } from '@renderer/lib/api'
import { toastError, toastInfo } from '@renderer/lib/toast'

const summarizeOutcomes = (outcomes: RefreshOutcome[]): string => {
  const count = (status: RefreshOutcome['status']): number =>
    outcomes.filter((o) => o.status === status).length
  const parts = [
    `${count('updated')} updated`,
    `${count('unchanged')} unchanged`,
    count('failed') ? `${count('failed')} failed` : undefined,
    count('skipped') ? `${count('skipped')} skipped` : undefined
  ].filter((part): part is string => part !== undefined)
  return outcomes.length === 0 ? 'No enabled subscriptions to refresh.' : parts.join(', ')
}

/** Refreshes every enabled subscription now and reports the outcome; failures keep the cached snapshot. */
export const refreshSubscriptionsNow = async (): Promise<void> => {
  try {
    const outcomes = await api('conferences:refresh', { force: true })
    toastInfo('Conference subscriptions refreshed', summarizeOutcomes(outcomes))
  } catch (error) {
    toastError(error, { retry: refreshSubscriptionsNow })
  }
}

/**
 * Palette commands for conference deadlines. "Add CCF Subscription" deep-links to the conference
 * tab with `create`, which opens the subscription builder from any page.
 */
export const conferenceDeadlineCommands: Command[] = [
  {
    id: 'conference-deadlines:add-subscription',
    title: 'Add conference',
    group: 'Create',
    keywords: ['conference', 'ccf', 'subscription', 'follow', 'deadline', 'new', 'add'],
    icon: Rss,
    run: (ctx) => ctx.navigate('deadlines', { tab: 'conference', create: 'true' })
  },
  {
    id: 'conference-deadlines:open',
    title: 'Go to Conference Deadlines',
    group: 'Navigate',
    keywords: ['conference', 'deadlines', 'ccf', 'open'],
    icon: CalendarClock,
    run: (ctx) => ctx.navigate('deadlines', { tab: 'conference' })
  },
  {
    id: 'conference-deadlines:refresh',
    title: 'Refresh conference subscriptions',
    group: 'Deadlines',
    keywords: ['conference', 'ccf', 'refresh', 'fetch', 'update', 'subscription', 'now'],
    icon: RefreshCw,
    run: () => refreshSubscriptionsNow()
  }
]
