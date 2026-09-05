import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import type { Milestone } from '@shared/types/milestone'
import type { DismissedWarning } from '@shared/types/settings'
import { useNavigation } from '@renderer/app/navigation'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { windowApi } from '../../../../tests/setup/renderer'
import TimelinePage from './TimelinePage'

const DAY = 24 * 60 * 60 * 1000
/** Instants relative to the real clock: the semester view is anchored on now. */
const at = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY).toISOString()

const milestone = (over: Partial<Milestone> & { id: string; title: string }): Milestone => ({
  startAt: at(-30),
  targetAt: at(30),
  category: 'research',
  status: 'in_progress',
  progress: 40,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over
})

// Radix dialogs set `pointer-events: none` on the body while open; skip that check.
const user = userEvent.setup({ pointerEventsCheck: 0 })

describe('TimelinePage', () => {
  let dismissed: DismissedWarning[]

  beforeEach(() => {
    dismissed = []
    useNavigation.setState({ page: 'timeline', params: {}, hydrated: true })
    windowApi.respond('milestones:list', [])
    windowApi.respond('personalDeadlines:list', [])
    windowApi.respond('settings:listDismissedWarnings', () => dismissed)
    windowApi.respond('settings:dismissWarning', (payload) => {
      const { key } = payload as { key: string }
      const record: DismissedWarning = { key, dismissedAt: '2026-09-05T00:00:00.000Z' }
      dismissed = [...dismissed, record]
      return record
    })
    windowApi.respond('milestones:create', (payload) => ({
      ...(payload as Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>),
      id: 'new1',
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z'
    }))
  })

  it('renders the empty state with the exact copy and an Add Milestone action', async () => {
    renderWithProviders(<TimelinePage />)
    expect(await screen.findByText('Your timeline starts here.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add Milestone' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('figure', { name: 'Milestone timeline' })).not.toBeInTheDocument()
  })

  it('draws a track per category with a bar per milestone in the semester view', async () => {
    windowApi.respond('milestones:list', [
      milestone({ id: 'm1', title: 'Coursework block', category: 'coursework' }),
      milestone({ id: 'm2', title: 'Pilot study', category: 'research', progress: 10 })
    ])
    renderWithProviders(<TimelinePage />)
    const figure = await screen.findByRole('figure', { name: 'Milestone timeline' })
    expect(
      within(figure).getByRole('button', { name: /Coursework block, 40% complete, In progress/ })
    ).toBeInTheDocument()
    expect(
      within(figure).getByRole('button', { name: /Pilot study, 10% complete/ })
    ).toBeInTheDocument()
    expect(within(figure).getByText('Today')).toBeInTheDocument()
    expect(within(figure).getByText('Coursework')).toBeInTheDocument()
    expect(within(figure).getByText('Research')).toBeInTheDocument()
  })

  it('switches to the chronological list and persists the view', async () => {
    windowApi.respond('milestones:list', [milestone({ id: 'm1', title: 'Pilot study' })])
    renderWithProviders(<TimelinePage />)
    await screen.findByRole('figure', { name: 'Milestone timeline' })
    await user.click(screen.getByRole('radio', { name: 'List' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pilot study' })).toBeInTheDocument()
    expect(screen.getByText('In progress')).toBeInTheDocument()
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('settings:updateUi', { timelineView: 'list' })
    )
  })

  it('shows a timeline check for a passed, incomplete milestone and dismisses it', async () => {
    windowApi.respond('milestones:list', [
      milestone({ id: 'm1', title: 'Old', startAt: at(-100), targetAt: at(-10) })
    ])
    renderWithProviders(<TimelinePage />)
    const title = 'Milestone "Old" is past its target but not complete'
    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.getByText(/Rule: Milestone passed but incomplete/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Dismiss/ }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith(
        'settings:dismissWarning',
        expect.objectContaining({ key: 'milestone_passed_incomplete:m1' })
      )
    )
    // The open list drops it (no rule line, no Dismiss button); it moves to the restorable list.
    await waitFor(() =>
      expect(screen.queryByText(/Rule: Milestone passed but incomplete/)).not.toBeInTheDocument()
    )
    expect(screen.queryByRole('button', { name: /^Dismiss/ })).not.toBeInTheDocument()
    expect(screen.getByText('Dismissed (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument()
  })

  it('creates a milestone through the form', async () => {
    renderWithProviders(<TimelinePage />)
    await screen.findByText('Your timeline starts here.')
    await user.click(screen.getAllByRole('button', { name: 'Add Milestone' })[0])
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Title'), 'Qualifying exam')
    await user.click(within(dialog).getByRole('button', { name: 'Create milestone' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith(
        'milestones:create',
        expect.objectContaining({
          title: 'Qualifying exam',
          category: 'research',
          status: 'not_started',
          progress: 0
        })
      )
    )
  })

  it('opens the editor for a deep-linked milestone', async () => {
    windowApi.respond('milestones:list', [milestone({ id: 'm1', title: 'Pilot study' })])
    useNavigation.setState({ page: 'timeline', params: { milestoneId: 'm1' }, hydrated: true })
    renderWithProviders(<TimelinePage />)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Edit milestone')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Pilot study')
  })
  it('draws followed conference deadlines as markers that open the conference', async () => {
    windowApi.respond('milestones:list', [milestone({ id: 'm1', title: 'Pilot study' })])
    const followed: ConferenceDeadlineView = {
      id: 'c1',
      subscriptionId: 's1',
      subscriptionLabel: 'deadlines_en',
      title: 'NeurIPS 2027',
      sourceUrl: 'https://ccfddl.com/conference/deadlines_en.ics',
      status: 'upcoming',
      deadlineAt: at(20),
      upstreamSnapshotHash: 'h1',
      createdAt: at(-10),
      updatedAt: at(-10),
      stableKey: 'neurips|2027|deadline|',
      deadlineKind: 'deadline',
      firstSeenAt: at(-10),
      lastSeenAt: at(0),
      allDay: false,
      followed: { conferenceDeadlineId: 'c1', followedAt: at(-5) }
    }
    windowApi.respond('conferences:listFollowed', [followed])
    renderWithProviders(<TimelinePage />)
    const figure = await screen.findByRole('figure', { name: 'Milestone timeline' })
    expect(within(figure).getByText('Followed conferences')).toBeInTheDocument()
    const marker = within(figure).getByRole('button', {
      name: /Conference deadline: NeurIPS 2027/
    })
    await user.click(marker)
    expect(useNavigation.getState().page).toBe('deadlines')
    expect(useNavigation.getState().params).toEqual({ tab: 'conference', id: 'c1' })
  })
})
