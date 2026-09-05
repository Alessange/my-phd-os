import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { useNavigation } from '@renderer/app/navigation'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { windowApi } from '../../../../../tests/setup/renderer'
import { DeadlineSummary } from './DeadlineSummary'

const DAY = 24 * 60 * 60 * 1000
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

describe('DeadlineSummary', () => {
  beforeEach(() => {
    useNavigation.setState({ page: 'deadlines', params: {}, hydrated: true })
    windowApi.respond('conferences:listFollowed', [])
  })

  it('renders nothing on a fresh install instead of zero-valued cards', async () => {
    windowApi.respond('personalDeadlines:list', [])
    const { container } = renderWithProviders(<DeadlineSummary />)
    // Wait for both queries to settle, then assert the section never appeared.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container).toBeEmptyDOMElement()
  })

  it('shows personal counts, the nearest deadline and the conference figure separately', async () => {
    windowApi.respond('personalDeadlines:list', [
      deadline({ id: 'd1', title: 'Paper draft' }),
      deadline({ id: 'd2', title: 'Grant report', status: 'completed', progress: 100 })
    ])
    renderWithProviders(<DeadlineSummary />)
    const section = await screen.findByRole('region', { name: 'Deadline summary' })
    const value = (label: string): string =>
      section.querySelector(`[data-summary="${label}"] .tabular`)?.textContent ?? ''
    expect(value('Active')).toBe('1')
    expect(value('At risk')).toBe('1')
    expect(value('Completed')).toBe('1')
    expect(value('Followed conferences')).toBe('0')
    expect(screen.getByRole('button', { name: /Paper draft/ })).toBeInTheDocument()
    expect(screen.getAllByText('Personal').length).toBeGreaterThan(0)
    expect(screen.getByText('Conferences')).toBeInTheDocument()
  })
})
