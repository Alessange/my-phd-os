import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Habit } from '@shared/types/habit'
import { useNavigation } from '@renderer/app/navigation'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { windowApi } from '../../../../tests/setup/renderer'
import HabitsPage from './HabitsPage'

const HABITS: Habit[] = [
  {
    id: 'h1',
    name: 'Reading',
    color: '#3b82f6',
    icon: 'BookOpen',
    frequency: { type: 'daily' },
    createdAt: '2026-08-01T00:00:00.000Z'
  },
  {
    id: 'h2',
    name: 'Exercise',
    color: '#22c55e',
    frequency: { type: 'weekly', targetCount: 3 },
    createdAt: '2026-08-01T00:00:00.000Z'
  }
]

// Radix menus/dialogs set `pointer-events: none` on the body while open; skip that check.
const user = userEvent.setup({ pointerEventsCheck: 0 })

describe('HabitsPage', () => {
  beforeEach(() => {
    useNavigation.setState({ page: 'habits', params: {}, hydrated: true })
    windowApi.respond('habits:list', HABITS)
    windowApi.respond('habits:listCompletions', [])
    windowApi.respond('habits:delete', { ok: true })
    windowApi.respond('habits:create', (payload) => {
      const input = payload as {
        name: string
        color: string
        icon?: string
        frequency: Habit['frequency']
      }
      return {
        id: 'new1',
        name: input.name,
        color: input.color,
        icon: input.icon,
        frequency: input.frequency,
        createdAt: '2026-09-04T12:00:00.000Z'
      }
    })
    windowApi.respond('habits:setCompletion', (payload) => {
      const input = payload as { habitId: string; date: string; completed: boolean }
      return { id: 'c1', habitId: input.habitId, date: input.date, completed: input.completed }
    })
  })

  it('renders the empty state when there are no habits', async () => {
    windowApi.respond('habits:list', [])
    renderWithProviders(<HabitsPage />)
    expect(await screen.findByText('No habits yet.')).toBeInTheDocument()
    expect(screen.queryByText('Reading')).not.toBeInTheDocument()
  })

  it('renders one row per habit and the day tally', async () => {
    renderWithProviders(<HabitsPage />)
    expect(await screen.findByText('Reading')).toBeInTheDocument()
    expect(screen.getByText('Exercise')).toBeInTheDocument()
    expect(screen.getByText('0 of 2 done today.')).toBeInTheDocument()
    // streak zero with no completions
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('keeps habit names directly under the page h1 as level-2 headings', async () => {
    renderWithProviders(<HabitsPage />)
    expect(await screen.findByRole('heading', { level: 2, name: 'Reading' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })

  it('creates a habit through the form', async () => {
    renderWithProviders(<HabitsPage />)
    await screen.findByText('Reading')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Deep Work')
    await user.click(within(dialog).getByRole('button', { name: /create habit/i }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith(
        'habits:create',
        expect.objectContaining({ name: 'Deep Work', frequency: { type: 'daily' } })
      )
    )
  })

  it('does not mark a pristine Name invalid and submits with Enter', async () => {
    renderWithProviders(<HabitsPage />)
    await screen.findByText('Reading')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByLabelText('Name')
    expect(name).not.toHaveAttribute('aria-invalid')
    await user.type(name, 'Stretch{Enter}')
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith(
        'habits:create',
        expect.objectContaining({ name: 'Stretch' })
      )
    )
  })

  it('keeps the stored icon and colour when editing', async () => {
    windowApi.respond('habits:update', HABITS[0])
    renderWithProviders(<HabitsPage />)
    await screen.findByText('Reading')
    await user.click(screen.getByRole('button', { name: 'Actions for Reading' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('habits:update', {
        id: 'h1',
        patch: expect.objectContaining({ color: '#3b82f6', icon: 'BookOpen' })
      })
    )
  })

  it('opens the form for every palette deep link, including repeats', async () => {
    renderWithProviders(<HabitsPage />)
    await screen.findByText('Reading')
    useNavigation.setState({ page: 'habits', params: { create: 'true' }, hydrated: true })
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(useNavigation.getState().params.create).toBeUndefined()
    useNavigation.setState({ page: 'habits', params: { create: 'true' }, hydrated: true })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('toggles today completion on a habit card', async () => {
    renderWithProviders(<HabitsPage />)
    const toggle = await screen.findByRole('switch', { name: 'Mark Reading done today' })
    await user.click(toggle)
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith(
        'habits:setCompletion',
        expect.objectContaining({ habitId: 'h1', completed: true })
      )
    )
  })

  it('asks for confirmation before deleting a habit', async () => {
    renderWithProviders(<HabitsPage />)
    await screen.findByText('Reading')
    await user.click(screen.getByRole('button', { name: 'Actions for Reading' }))
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }))
    const confirm = await screen.findByRole('alertdialog')
    expect(windowApi.invoke).not.toHaveBeenCalledWith('habits:delete', expect.anything())
    await user.click(within(confirm).getByRole('button', { name: 'Delete habit' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('habits:delete', { id: 'h1' })
    )
  })
})
