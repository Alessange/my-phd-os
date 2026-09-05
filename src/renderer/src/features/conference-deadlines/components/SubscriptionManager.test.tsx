import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ConferenceSubscription, RefreshStatus } from '@shared/types/conference'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { windowApi } from '../../../../../../tests/setup/renderer'
import { SubscriptionManager } from './SubscriptionManager'

const DAY = 24 * 60 * 60 * 1000
const at = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY).toISOString()

const SUBSCRIPTION: ConferenceSubscription = {
  id: 's1',
  url: 'https://ccfddl.com/conference/deadlines_en_core_Astar_SE.ics',
  label: 'deadlines_en_core_Astar_SE',
  kind: 'official',
  language: 'en',
  filters: { core: 'A*', subject: 'SE' },
  enabled: true,
  etag: '"abc"',
  lastSuccessAt: at(-1),
  lastAttemptAt: at(-0.5),
  lastError: { message: 'Request timed out after 20 s', code: 'TIMEOUT', at: at(-0.5) },
  createdAt: at(-10),
  updatedAt: at(-0.5)
}

const STATUS: RefreshStatus = {
  inProgress: false,
  lastSuccessAt: at(-1),
  lastAttemptAt: at(-0.5),
  lastError: { message: 'Request timed out after 20 s', code: 'TIMEOUT', at: at(-0.5) },
  perSubscription: { s1: { subscriptionId: 's1', inProgress: false, lastSuccessAt: at(-1) } }
}

const user = userEvent.setup({ pointerEventsCheck: 0 })

describe('SubscriptionManager', () => {
  beforeEach(() => {
    windowApi.respond('conferences:listSubscriptions', [SUBSCRIPTION])
    windowApi.respond('conferences:getRefreshStatus', STATUS)
    windowApi.respond('conferences:refresh', [])
    windowApi.respond('conferences:updateSubscription', (payload) => ({
      ...SUBSCRIPTION,
      ...((payload as { patch: Partial<ConferenceSubscription> }).patch ?? {})
    }))
    windowApi.respond('conferences:removeSubscription', { ok: true, removedDeadlines: 12 })
  })

  it('lists subscriptions with their filters, status and last error, and refreshes all', async () => {
    renderWithProviders(<SubscriptionManager />)
    const list = await screen.findByRole('list', { name: 'Conference subscriptions' })
    expect(within(list).getByText('deadlines_en_core_Astar_SE')).toBeInTheDocument()
    expect(within(list).getByText('CORE A*, SE')).toBeInTheDocument()
    expect(within(list).getByText(/Error: Request timed out/)).toBeInTheDocument()
    expect(screen.getByTestId('refresh-summary')).toHaveTextContent('Last refreshed')
    expect(screen.getByText('The last refresh failed; cached data is shown')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Refresh now' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('conferences:refresh', { force: true })
    )
  })

  it('disables a subscription with the switch', async () => {
    renderWithProviders(<SubscriptionManager />)
    await user.click(
      await screen.findByRole('switch', { name: 'Enable deadlines_en_core_Astar_SE' })
    )
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('conferences:updateSubscription', {
        id: 's1',
        patch: { enabled: false }
      })
    )
  })

  it('removes a subscription only after confirmation', async () => {
    renderWithProviders(<SubscriptionManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Remove deadlines_en_core_Astar_SE' })
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(windowApi.invoke).not.toHaveBeenCalledWith('conferences:removeSubscription', {
      id: 's1'
    })
    await user.click(within(dialog).getByRole('button', { name: 'Remove subscription' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('conferences:removeSubscription', {
        id: 's1'
      })
    )
  })

  it('shows the exact empty copy when nothing is subscribed', async () => {
    windowApi.respond('conferences:listSubscriptions', [])
    renderWithProviders(<SubscriptionManager />)
    expect(await screen.findByText('No conference subscription yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add CCF Subscription' })).toBeInTheDocument()
  })
})
