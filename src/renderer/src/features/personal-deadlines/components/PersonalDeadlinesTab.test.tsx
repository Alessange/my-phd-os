import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@shared/types/calendar'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { useNavigation } from '@renderer/app/navigation'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { windowApi } from '../../../../../../tests/setup/renderer'
import { PersonalDeadlinesTab } from './PersonalDeadlinesTab'

const DAY = 24 * 60 * 60 * 1000
/** Instants relative to the real clock: status rules and the timeline are anchored on now. */
const at = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY).toISOString()

const deadline = (
  over: Partial<PersonalDeadline> & { id: string; title: string }
): PersonalDeadline => ({
  trackingStartAt: at(-20),
  deadlineAt: at(20),
  timezone: 'UTC',
  category: 'paper',
  priority: 'high',
  status: 'in_progress',
  progress: 10,
  createdAt: at(-30),
  updatedAt: at(-30),
  ...over
})

// Time progress is 50 % for the default window, so progress 10 is "At Risk" (gap > 20 points).
const DEADLINES: PersonalDeadline[] = [
  deadline({ id: 'd1', title: 'Paper draft', tags: ['thesis'] }),
  deadline({
    id: 'd2',
    title: 'Grant report',
    status: 'completed',
    progress: 100,
    category: 'scholarship'
  })
]

const user = userEvent.setup({ pointerEventsCheck: 0 })

describe('PersonalDeadlinesTab', () => {
  beforeEach(() => {
    useNavigation.setState({ page: 'deadlines', params: { tab: 'personal' }, hydrated: true })
    windowApi.respond('personalDeadlines:list', DEADLINES)
    windowApi.respond('milestones:list', [])
    windowApi.respond('personalDeadlines:create', (payload) => ({
      ...(payload as Omit<PersonalDeadline, 'id' | 'createdAt' | 'updatedAt'>),
      id: 'new1',
      createdAt: at(0),
      updatedAt: at(0)
    }))
    windowApi.respond('personalDeadlines:setProgress', (payload) => {
      const { id, progress } = payload as { id: string; progress: number }
      const base = DEADLINES.find((d) => d.id === id) ?? DEADLINES[0]
      return { ...base, progress }
    })
    windowApi.respond('personalDeadlines:linkCalendarEvent', (payload) => {
      const { id } = payload as { id: string }
      const base = DEADLINES.find((d) => d.id === id) ?? DEADLINES[0]
      const event: CalendarEvent = {
        id: 'e1',
        title: base.title,
        startAt: base.deadlineAt.slice(0, 10),
        endAt: base.deadlineAt.slice(0, 10),
        timezone: 'UTC',
        allDay: true,
        category: 'deadline',
        sourceManaged: false,
        linkedPersonalDeadlineId: id,
        createdAt: at(0),
        updatedAt: at(0)
      }
      return { deadline: { ...base, linkedCalendarEventId: 'e1' }, event }
    })
  })

  it('renders the exact empty-state copy with the Add action', async () => {
    windowApi.respond('personalDeadlines:list', [])
    renderWithProviders(<PersonalDeadlinesTab />)
    expect(await screen.findByText('No personal deadlines yet.')).toBeInTheDocument()
    expect(
      screen.getByText('Countdowns and progress tracking appear after you add a deadline.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Personal Deadline' })).toBeInTheDocument()
  })

  it('shows active deadlines as bars by default and as cards on request, hiding completed ones', async () => {
    renderWithProviders(<PersonalDeadlinesTab />)
    await user.click(await screen.findByRole('radio', { name: 'Cards' }))
    expect(await screen.findByRole('button', { name: 'Paper draft' })).toBeInTheDocument()
    expect(screen.queryByText('Grant report')).not.toBeInTheDocument()
    expect(screen.getByText('At Risk')).toBeInTheDocument()
    expect(screen.getByTestId('deadline-count')).toHaveTextContent('1 of 2 deadlines')
  })

  it('switches scope to completed and view to list, persisting the view', async () => {
    renderWithProviders(<PersonalDeadlinesTab />)
    await screen.findByRole('button', { name: /Paper draft/ })
    await user.click(screen.getByRole('radio', { name: 'Completed' }))
    expect(await screen.findByRole('button', { name: /Grant report/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Paper draft/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'List' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('settings:updateUi', {
        personalDeadlinesView: 'list'
      })
    )
  })

  it('creates a deadline with canonical instants and the app timezone', async () => {
    windowApi.respond('personalDeadlines:list', [])
    renderWithProviders(<PersonalDeadlinesTab />)
    await user.click(await screen.findByRole('button', { name: 'Add Personal Deadline' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Title'), 'Quals')
    await user.click(within(dialog).getByRole('button', { name: 'Create deadline' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith(
        'personalDeadlines:create',
        expect.objectContaining({
          title: 'Quals',
          category: 'paper',
          priority: 'medium',
          status: 'not_started',
          progress: 0,
          timezone: expect.any(String),
          trackingStartAt: expect.stringMatching(/Z$/),
          deadlineAt: expect.stringMatching(/Z$/)
        })
      )
    )
  })

  it('opens the details drawer, saves progress and links to the calendar', async () => {
    renderWithProviders(<PersonalDeadlinesTab />)
    await user.click(await screen.findByRole('button', { name: /Paper draft/ }))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Update work progress')).toBeInTheDocument()
    const input = within(drawer).getByLabelText('Work progress')
    await user.clear(input)
    await user.type(input, '70')
    await user.click(within(drawer).getByRole('button', { name: 'Save progress' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('personalDeadlines:setProgress', {
        id: 'd1',
        progress: 70
      })
    )
    await user.click(within(drawer).getByRole('button', { name: 'Add as all-day' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('personalDeadlines:linkCalendarEvent', {
        id: 'd1',
        mode: 'allDay'
      })
    )
  })

  it('opens the details drawer for a deep-linked deadline', async () => {
    useNavigation.setState({
      page: 'deadlines',
      params: { tab: 'personal', id: 'd2' },
      hydrated: true
    })
    renderWithProviders(<PersonalDeadlinesTab />)
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByRole('heading', { name: 'Grant report' })).toBeInTheDocument()
  })
})
