import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarDays } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the title, description and one button per action', async () => {
    const onImport = vi.fn()
    const onCreate = vi.fn()
    render(
      <EmptyState
        icon={CalendarDays}
        title={EMPTY_STATES.calendar.title}
        description="Import or create."
        actions={[
          { label: 'Import .ics', onClick: onImport, variant: 'outline' },
          { label: 'Create event', onClick: onCreate }
        ]}
      />
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your calendar is empty.' })
    ).toBeInTheDocument()
    expect(screen.getByText('Import or create.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Import .ics' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('renders actions as text links, never a second ink primary, unless one opts in', () => {
    render(
      <EmptyState
        title="Nothing yet."
        actions={[
          { label: 'First', onClick: vi.fn() },
          { label: 'Second', onClick: vi.fn(), variant: 'outline' }
        ]}
      />
    )
    for (const name of ['First', 'Second']) {
      const action = screen.getByRole('button', { name })
      expect(action).toHaveClass('link')
      expect(action).not.toHaveAttribute('data-slot', 'button')
    }
  })

  it('renders a solid button only for an explicit default variant', () => {
    render(
      <EmptyState
        title="Nothing yet."
        actions={[{ label: 'Go', onClick: vi.fn(), variant: 'default' }]}
      />
    )
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('data-slot', 'button')
  })

  it('renders the compact variant as a single status line', () => {
    render(<EmptyState variant="compact" title={EMPTY_STATES.todayHabits.title} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('No habits for today.')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
