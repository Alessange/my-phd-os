import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent, IcsImportPreview } from '@shared/types/calendar'
import { dispatchCommand } from '@renderer/app/commandBus'
import { useNavigation } from '@renderer/app/navigation'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { windowApi } from '../../../../tests/setup/renderer'
import CalendarPage from './CalendarPage'

// FullCalendar's grid needs real layout; the page logic is what this file tests.
vi.mock('@fullcalendar/react', () => ({
  default: forwardRef<unknown, { events: unknown[] }>(function FullCalendarStub(props) {
    return <div data-testid="fullcalendar">{props.events.length} board events</div>
  })
}))

const at = (offsetHours: number): string =>
  new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString()

const event = (over: Partial<CalendarEvent> & { id: string; title: string }): CalendarEvent => ({
  startAt: at(2),
  endAt: at(3),
  timezone: 'UTC',
  allDay: false,
  category: 'meeting',
  sourceManaged: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over
})

const user = userEvent.setup({ pointerEventsCheck: 0 })

describe('CalendarPage', () => {
  beforeEach(() => {
    useNavigation.setState({ page: 'calendar', params: {}, hydrated: true })
    windowApi.respond('calendar:listEvents', [])
    windowApi.respond('calendar:listSources', [])
    windowApi.respond('personalDeadlines:list', [])
    windowApi.respond('conferences:listFollowed', [])
    windowApi.respond('habits:list', [])
    windowApi.respond('habits:listCompletions', [])
    windowApi.respond('calendar:createEvent', (payload) => ({
      ...(payload as Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>),
      id: 'new1',
      createdAt: at(0),
      updatedAt: at(0)
    }))
  })

  it('shows the exact empty-state copy with Import and Create actions on a fresh install', async () => {
    renderWithProviders(<CalendarPage />)
    expect(await screen.findByText('Your calendar is empty.')).toBeInTheDocument()
    // Header action + empty-state action.
    expect(screen.getAllByRole('button', { name: 'Import .ics' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Create Event' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Event' })).toBeInTheDocument()
    expect(screen.getByTestId('calendar-now')).toHaveTextContent('No upcoming event.')
  })

  it('lists today’s events in the panel, names the next one, and renders the board', async () => {
    windowApi.respond('calendar:listEvents', [
      event({ id: 'e1', title: 'Supervisor meeting' }),
      event({ id: 'e2', title: 'Far away', startAt: at(24 * 30), endAt: at(24 * 30 + 1) })
    ])
    renderWithProviders(<CalendarPage />)
    expect(await screen.findByTestId('fullcalendar')).toBeInTheDocument()
    const panel = screen.getByRole('list', { name: "Today's events" })
    expect(within(panel).getByText('Supervisor meeting')).toBeInTheDocument()
    expect(screen.getByTestId('next-event')).toHaveTextContent('Supervisor meeting')
    expect(screen.getByTestId('calendar-now')).toHaveTextContent('Next: Supervisor meeting')
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true')
  })

  it('creates an event through the form with the app timezone', async () => {
    renderWithProviders(<CalendarPage />)
    await user.click(await screen.findByRole('button', { name: 'Add Event' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Title'), 'Reading group')
    await user.click(within(dialog).getByRole('button', { name: 'Create event' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith(
        'calendar:createEvent',
        expect.objectContaining({
          title: 'Reading group',
          allDay: false,
          category: 'meeting',
          sourceManaged: false,
          timezone: expect.any(String),
          startAt: expect.stringMatching(/Z$/),
          endAt: expect.stringMatching(/Z$/)
        })
      )
    )
  })

  it('opens a deep-linked event in the details drawer and offers Edit for editable events only', async () => {
    windowApi.respond('calendar:listEvents', [
      event({ id: 'e1', title: 'Supervisor meeting' }),
      event({
        id: 'c1',
        title: 'NeurIPS 2027 Deadline',
        category: 'deadline',
        sourceManaged: true,
        sourceLabel: 'CCF Deadlines',
        linkedConferenceDeadlineId: 'conf-1'
      })
    ])
    useNavigation.setState({ page: 'calendar', params: { eventId: 'c1' }, hydrated: true })
    renderWithProviders(<CalendarPage />)
    const drawer = await screen.findByRole('dialog')
    expect(
      within(drawer).getByRole('heading', { name: 'NeurIPS 2027 Deadline' })
    ).toBeInTheDocument()
    expect(within(drawer).getByText(/Managed by CCF Deadlines/)).toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Remove from calendar' })).toBeInTheDocument()
  })

  it('imports .ics files: pick, preview, confirm', async () => {
    const preview: IcsImportPreview = {
      previewToken: 'tok',
      files: [{ name: 'seminar.ics', sizeBytes: 1200, eventCount: 3, warnings: [] }],
      recognizedEvents: 3,
      dateRange: { start: '2026-09-08T17:00:00.000Z', end: '2026-12-15T18:30:00.000Z' },
      sampleEvents: [
        {
          key: 'k1',
          fileName: 'seminar.ics',
          title: 'Group seminar',
          startAt: '2026-09-08T17:00:00.000Z',
          endAt: '2026-09-08T18:30:00.000Z',
          allDay: false,
          timezone: 'America/Los_Angeles',
          recurring: true,
          cancelled: false
        }
      ],
      conflicts: [],
      warnings: [],
      invalidFiles: []
    }
    windowApi.respond('calendar:pickIcsFiles', {
      canceled: false,
      files: [{ name: 'seminar.ics', text: 'BEGIN:VCALENDAR' }]
    })
    windowApi.respond('calendar:previewIcsImport', preview)
    windowApi.respond('calendar:commitIcsImport', {
      imported: 3,
      skipped: 0,
      replaced: 0,
      sourceId: 's1',
      eventIds: ['a', 'b', 'c']
    })
    renderWithProviders(<CalendarPage />)
    await user.click(await screen.findByRole('button', { name: 'Import .ics' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Choose files…' }))
    expect(await within(dialog).findByTestId('import-recognized')).toHaveTextContent('3 events')
    expect(within(dialog).getByText('Group seminar')).toBeInTheDocument()
    expect(windowApi.invoke).not.toHaveBeenCalledWith('calendar:commitIcsImport', expect.anything())
    await user.click(within(dialog).getByRole('button', { name: /^Import 3 events/ }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('calendar:commitIcsImport', {
        previewToken: 'tok',
        conflictPolicy: 'skip',
        source: { mode: 'new', name: 'seminar', color: '#3b82f6' }
      })
    )
  })

  it('switches views from the palette command and persists the choice', async () => {
    windowApi.respond('calendar:listEvents', [event({ id: 'e1', title: 'Supervisor meeting' })])
    renderWithProviders(<CalendarPage />)
    await screen.findByTestId('fullcalendar')
    dispatchCommand('calendar:view', { view: 'listWeek' })
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Agenda' })).toHaveAttribute('aria-checked', 'true')
    )
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('settings:updateUi', {
        calendarView: 'listWeek'
      })
    )
  })
})
