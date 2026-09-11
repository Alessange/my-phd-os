import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type {
  ConferenceDeadlineChangeView,
  ConferenceDeadlineView,
  ConferenceSubscription,
  FollowedConference,
  RefreshStatus
} from '@shared/types/conference'
import { useNavigation } from '@renderer/app/navigation'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { windowApi } from '../../../../../../tests/setup/renderer'
import { ConferenceDeadlinesTab } from './ConferenceDeadlinesTab'

const DAY = 24 * 60 * 60 * 1000
const at = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY).toISOString()

const EN_URL = 'https://ccfddl.com/conference/deadlines_en.ics'

const SUBSCRIPTION: ConferenceSubscription = {
  id: 's1',
  url: EN_URL,
  label: 'deadlines_en',
  kind: 'official',
  language: 'en',
  filters: {},
  enabled: true,
  lastSuccessAt: at(-1),
  lastAttemptAt: at(-1),
  createdAt: at(-10),
  updatedAt: at(-1)
}

const STATUS: RefreshStatus = {
  inProgress: false,
  lastSuccessAt: at(-1),
  lastAttemptAt: at(-1),
  perSubscription: { s1: { subscriptionId: 's1', inProgress: false, lastSuccessAt: at(-1) } }
}

const view = (
  over: Partial<ConferenceDeadlineView> & { id: string; title: string }
): ConferenceDeadlineView => ({
  subscriptionId: 's1',
  subscriptionLabel: 'deadlines_en',
  sourceUrl: EN_URL,
  status: 'upcoming',
  upstreamSnapshotHash: 'h1',
  createdAt: at(-10),
  updatedAt: at(-10),
  stableKey: over.id,
  deadlineKind: 'deadline',
  firstSeenAt: at(-10),
  lastSeenAt: at(0),
  allDay: false,
  originalTimezone: 'UTC-12:00',
  originalTimezoneLabel: 'AoE',
  ...over
})

const follow = (id: string, days: number): FollowedConference => ({
  conferenceDeadlineId: id,
  followedAt: at(days)
})

const NEURIPS = view({
  id: 'c1',
  title: 'NeurIPS 2027',
  conferenceName: 'NeurIPS',
  conferenceYear: 2027,
  fullName: 'Conference on Neural Information Processing Systems',
  category: 'AI',
  ccfRank: 'A',
  coreRank: 'A*',
  deadlineAt: at(30),
  location: 'Vancouver, Canada',
  homepageUrl: 'https://neurips.cc',
  followed: follow('c1', -5)
})
const ICML_TBD = view({
  id: 'c2',
  title: 'ICML 2027',
  conferenceName: 'ICML',
  conferenceYear: 2027,
  status: 'tbd',
  deadlineAt: undefined,
  originalTimezone: undefined,
  originalTimezoneLabel: undefined,
  followed: follow('c2', -2)
})
const ICSE_PASSED = view({
  id: 'c3',
  title: 'ICSE 2027',
  conferenceName: 'ICSE',
  conferenceYear: 2027,
  status: 'passed',
  deadlineAt: at(-3),
  followed: follow('c3', -20)
})
const SIGGRAPH = view({
  id: 'c4',
  title: 'SIGGRAPH 2027',
  conferenceName: 'SIGGRAPH',
  conferenceYear: 2027,
  ccfRank: 'A',
  deadlineAt: at(60)
})

const FOLLOWED = [NEURIPS, ICML_TBD, ICSE_PASSED]
const ALL = [...FOLLOWED, SIGGRAPH]

const CHANGE: ConferenceDeadlineChangeView = {
  id: 'ch1',
  conferenceDeadlineId: 'c1',
  conferenceTitle: 'NeurIPS 2027',
  followed: true,
  field: 'deadlineAt',
  previousValue: at(23),
  currentValue: at(30),
  detectedAt: at(-1),
  upstreamSnapshotHash: 'h2',
  acknowledged: false
}

const user = userEvent.setup({ pointerEventsCheck: 0 })

describe('ConferenceDeadlinesTab', () => {
  beforeEach(() => {
    useNavigation.setState({ page: 'deadlines', params: { tab: 'conference' }, hydrated: true })
    windowApi.respond('conferences:listSubscriptions', [SUBSCRIPTION])
    windowApi.respond('conferences:getRefreshStatus', STATUS)
    windowApi.respond('conferences:listFollowed', FOLLOWED)
    windowApi.respond('conferences:listDeadlines', ALL)
    windowApi.respond('conferences:listChanges', [])
    windowApi.respond('conferences:refresh', [])
    windowApi.respond('conferences:follow', (payload) => ({
      conferenceDeadlineId: (payload as { id: string }).id,
      followedAt: at(0)
    }))
    windowApi.respond('conferences:unfollow', { ok: true })
    windowApi.respond('conferences:addToCalendar', () => ({
      id: 'e1',
      title: 'NeurIPS 2027',
      startAt: at(30),
      endAt: at(30),
      timezone: 'UTC-12:00',
      allDay: false,
      category: 'deadline',
      sourceManaged: true,
      createdAt: at(0),
      updatedAt: at(0)
    }))
    windowApi.respond('conferences:acknowledgeChanges', { ok: true })
    windowApi.respond('conferences:getDeadline', (payload) => {
      const { id } = payload as { id: string }
      return ALL.find((c) => c.id === id) ?? ALL[0]
    })
    windowApi.respond('conferences:addSubscription', (payload) => ({
      ...SUBSCRIPTION,
      ...(payload as Partial<ConferenceSubscription>),
      id: 's2',
      label: 'new'
    }))
  })

  it('on a fresh install shows the exact copy and loads the CCF list with one click', async () => {
    windowApi.respond('conferences:listSubscriptions', [])
    windowApi.respond('conferences:listFollowed', [])
    windowApi.respond('conferences:listDeadlines', [])
    renderWithProviders(<ConferenceDeadlinesTab />)
    expect(await screen.findByText('No conference subscription yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter Subscription URL' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add conference' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByRole('button', { name: 'Load list (English)' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith(
        'conferences:addSubscription',
        expect.objectContaining({ url: EN_URL, kind: 'official', language: 'en' })
      )
    )
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('conferences:refresh', {
        subscriptionId: 's2'
      })
    )
  })

  it('shows chosen conferences as bars with a big countdown, hides passed ones, never fakes TBD', async () => {
    renderWithProviders(<ConferenceDeadlinesTab />)
    const neurips = await screen.findByRole('button', { name: 'NeurIPS 2027' })
    expect(screen.getByTestId('board-summary')).toHaveTextContent(
      '2 conferences · next: NeurIPS 2027 in'
    )
    expect(
      screen.getByRole('figure', { name: 'Deadlines over the coming months' })
    ).toBeInTheDocument()
    expect(within(neurips).getByRole('progressbar')).toHaveAttribute('aria-valuenow')
    expect(within(neurips).getByText('CCF A · CORE A*')).toBeInTheDocument()
    expect(neurips.querySelector('[data-countdown="future"]')).not.toBeNull()
    expect(within(neurips).getByText(/AoE/)).toBeInTheDocument()

    const icml = screen.getByRole('button', { name: 'ICML 2027' })
    expect(within(icml).getByText('TBD')).toBeInTheDocument()
    expect(within(icml).getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')

    expect(screen.queryByRole('button', { name: 'ICSE 2027' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Show passed' }))
    const icse = await screen.findByRole('button', { name: 'ICSE 2027' })
    expect(within(icse).getByText('Passed')).toBeInTheDocument()
    expect(screen.getByTestId('refresh-indicator')).toHaveTextContent('CCF Deadlines list updated')
  })

  it('opens the details sheet from a row and adds the conference to the calendar', async () => {
    renderWithProviders(<ConferenceDeadlinesTab />)
    await user.click(await screen.findByRole('button', { name: 'NeurIPS 2027' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'NeurIPS 2027' })).toBeInTheDocument()
    expect(within(sheet).getByText('Vancouver, Canada')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Unfollow' })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Add to Calendar' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('conferences:addToCalendar', { id: 'c1' })
    )
  })

  it('adds a conference by searching the CCF list in the picker', async () => {
    renderWithProviders(<ConferenceDeadlinesTab />)
    await user.click(await screen.findByRole('button', { name: 'Add conference' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Search conferences' }),
      'siggraph'
    )
    const results = within(dialog).getByRole('list', { name: 'Search results' })
    expect(within(results).getAllByRole('listitem')).toHaveLength(1)
    await user.click(within(results).getByRole('button', { name: 'Add SIGGRAPH 2027' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('conferences:follow', { id: 'c4' })
    )
    // Already-chosen conferences show as added and can be removed from the same place.
    await user.clear(within(dialog).getByRole('searchbox', { name: 'Search conferences' }))
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Search conferences' }),
      'neurips'
    )
    await user.click(within(dialog).getByRole('button', { name: 'Remove NeurIPS 2027' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('conferences:unfollow', { id: 'c1' })
    )
  })

  it('shows upstream changes for chosen conferences and acknowledges them', async () => {
    windowApi.respond('conferences:listChanges', [CHANGE])
    renderWithProviders(<ConferenceDeadlinesTab />)
    const banner = await screen.findByTestId('changes-banner')
    expect(
      within(banner).getByText('NeurIPS 2027 was updated by CCF Deadlines.')
    ).toBeInTheDocument()
    expect(within(banner).getByText(/^Previous: /)).toBeInTheDocument()
    const neurips = screen.getByRole('button', { name: 'NeurIPS 2027' })
    expect(
      within(neurips).getByRole('img', { name: 'Updated from CCF Deadlines' })
    ).toBeInTheDocument()
    await user.click(within(banner).getByRole('button', { name: 'Acknowledge all' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('conferences:acknowledgeChanges', {
        ids: ['ch1']
      })
    )
  })

  it('opens the sheet for a deep-linked conference, even one that is not chosen', async () => {
    useNavigation.setState({
      page: 'deadlines',
      params: { tab: 'conference', id: 'c4' },
      hydrated: true
    })
    renderWithProviders(<ConferenceDeadlinesTab />)
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'SIGGRAPH 2027' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Follow' })).toBeInTheDocument()
  })
  it('gives every row its own colour and a bar that actually advances', async () => {
    // Regressions guarded here: the bar once measured time elapsed since following, so a
    // conference added today rendered a 0%-wide fill on a grey track and looked broken; and the
    // colour came only from urgency, so everything past thirty days was the same blue. A later
    // version scaled every bar against the furthest deadline, which left that conference pinned
    // at 100% for ever and the rest moving too slowly to see.
    const justAdded = view({
      id: 'c5',
      title: 'CHI 2027',
      conferenceName: 'CHI',
      conferenceYear: 2027,
      deadlineAt: at(60),
      firstSeenAt: at(0),
      followed: follow('c5', 0)
    })
    windowApi.respond('conferences:listFollowed', [NEURIPS, justAdded, ICML_TBD])
    renderWithProviders(<ConferenceDeadlinesTab />)

    const neurips = await screen.findByRole('button', { name: 'NeurIPS 2027' })
    const chi = screen.getByRole('button', { name: 'CHI 2027' })
    const icml = screen.getByRole('button', { name: 'ICML 2027' })

    const colours = [neurips, chi, icml].map((row) => row.getAttribute('data-color'))
    expect(new Set(colours).size).toBe(3)
    for (const c of colours) expect(c).toMatch(/^conference-([1-9]|10)$/)

    // Added moments ago: nothing has elapsed yet, but the track still carries its own colour
    // rather than rendering as an empty grey box.
    const chiBar = within(chi).getByRole('progressbar')
    expect(Number(chiBar.getAttribute('aria-valuenow'))).toBe(0)
    expect(chiBar.className).toContain('bg-(--chip)/15')

    // Followed five days ago with thirty days to run: about a seventh of the way along, and
    // crucially neither pinned at nought nor at full.
    const neuripsValue = Number(
      within(neurips).getByRole('progressbar').getAttribute('aria-valuenow')
    )
    expect(neuripsValue).toBeGreaterThan(0)
    expect(neuripsValue).toBeLessThan(100)
    expect(within(neurips).getByText(`${neuripsValue}% of the way there`)).toBeInTheDocument()

    // No announced date means nothing to measure, rather than a fabricated bar.
    expect(within(icml).getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(within(icml).getByText('Waiting for a date')).toBeInTheDocument()
  })
})
