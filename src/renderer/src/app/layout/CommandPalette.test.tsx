import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCommandPalette } from '@renderer/app/commands'
import { useNavigation } from '@renderer/app/navigation'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { CommandPalette } from './CommandPalette'

describe('CommandPalette', () => {
  beforeEach(() => {
    useNavigation.setState({ page: 'calendar', params: {}, hydrated: false })
    useCommandPalette.setState({ open: true })
  })

  it('lists the shell commands grouped by section', async () => {
    renderWithProviders(<CommandPalette />)
    expect(await screen.findByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
    for (const title of [
      'Go to Calendar',
      'Go to Deadlines',
      'Go to Settings',
      'Create…',
      'Import .ics files',
      'Use dark theme',
      'Toggle sidebar',
      'Settings: Data'
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
    expect(screen.getByText('Go to today')).toBeInTheDocument()
    expect(screen.getByText('Navigate')).toBeInTheDocument()
  })

  it('runs a navigation command and closes', async () => {
    renderWithProviders(<CommandPalette />)
    await userEvent.click(await screen.findByText('Go to Deadlines'))
    expect(useNavigation.getState().page).toBe('deadlines')
    expect(useCommandPalette.getState().open).toBe(false)
  })

  it('filters commands by the typed query', async () => {
    renderWithProviders(<CommandPalette />)
    await userEvent.type(await screen.findByRole('combobox'), 'habits')
    expect(screen.getByText('Go to Habits')).toBeInTheDocument()
    expect(screen.queryByText('Go to Timeline')).not.toBeInTheDocument()
  })
})
