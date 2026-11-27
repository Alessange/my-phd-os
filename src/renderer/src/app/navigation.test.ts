import { beforeEach, describe, expect, it, vi } from 'vitest'
import { windowApi } from '../../../../tests/setup/renderer'
import { queryClient } from './queryClient'
import { calendarCommands } from '@renderer/features/calendar/commands'
import { conferenceDeadlineCommands } from '@renderer/features/conference-deadlines/commands'
import { habitCommands } from '@renderer/features/habits/commands'
import { personalDeadlineCommands } from '@renderer/features/personal-deadlines/commands'
import { timelineCommands } from '@renderer/features/timeline/commands'
import { PAGES, getPage, resolveCreateAction, useNavigation } from './navigation'

const resetStore = (): void =>
  useNavigation.setState({ page: 'calendar', params: {}, hydrated: false })

describe('navigation store', () => {
  beforeEach(() => {
    resetStore()
    queryClient.clear()
  })

  it('lists the five pages in spec order with 1-based shortcut indexes', () => {
    expect(PAGES.map((page) => page.id)).toEqual([
      'calendar',
      'deadlines',
      'timeline',
      'habits',
      'settings'
    ])
    expect(PAGES.map((page) => page.shortcutIndex)).toEqual([1, 2, 3, 4, 5])
  })

  it('navigates with params but does not persist before hydration', () => {
    useNavigation.getState().navigate('deadlines', { tab: 'personal' })
    expect(useNavigation.getState()).toMatchObject({
      page: 'deadlines',
      params: { tab: 'personal' }
    })
    expect(windowApi.invoke).not.toHaveBeenCalledWith('settings:updateUi', expect.anything())
  })

  it('hydrates from the persisted last page unless launch behaviour forces Calendar', () => {
    useNavigation.getState().hydrate('habits', 'last')
    expect(useNavigation.getState().page).toBe('habits')
    resetStore()
    useNavigation.getState().hydrate('habits', 'calendar')
    expect(useNavigation.getState().page).toBe('calendar')
    useNavigation.getState().hydrate('timeline', 'last')
    expect(useNavigation.getState().page).toBe('calendar')
  })

  it('persists lastPage through settings:updateUi after hydration', async () => {
    useNavigation.getState().hydrate('calendar', 'last')
    useNavigation.getState().navigate('timeline')
    await vi.waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('settings:updateUi', { lastPage: 'timeline' })
    )
  })

  it('goes back to the previous page', () => {
    useNavigation.getState().navigate('habits')
    useNavigation.getState().navigate('settings', { section: 'data' })
    useNavigation.getState().back()
    expect(useNavigation.getState()).toMatchObject({ page: 'habits', params: {} })
  })
})

describe('resolveCreateAction', () => {
  it('uses the page create label on Calendar, Timeline and Habits and none on Settings', () => {
    expect(resolveCreateAction(getPage('calendar'))).toEqual({ label: 'Add event' })
    expect(resolveCreateAction(getPage('timeline'))?.label).toBe('Add milestone')
    expect(resolveCreateAction(getPage('habits'))?.label).toBe('Create habit')
    expect(resolveCreateAction(getPage('settings'))).toBeUndefined()
  })

  it('makes the Deadlines label follow the active tab', () => {
    expect(resolveCreateAction(getPage('deadlines'), 'conference')).toEqual({
      label: 'Add conference'
    })
    expect(resolveCreateAction(getPage('deadlines'), 'personal')).toEqual({
      label: 'Add personal deadline'
    })
  })
})

describe('create labels', () => {
  it('are one sentence-case set shared by the strip and the palette', () => {
    const strip = [
      resolveCreateAction(getPage('calendar'))?.label,
      resolveCreateAction(getPage('deadlines'), 'conference')?.label,
      resolveCreateAction(getPage('deadlines'), 'personal')?.label,
      resolveCreateAction(getPage('timeline'))?.label,
      resolveCreateAction(getPage('habits'))?.label
    ]
    const palette = [
      ...calendarCommands,
      ...conferenceDeadlineCommands,
      ...personalDeadlineCommands,
      ...timelineCommands,
      ...habitCommands
    ]
      .filter((command) => command.group === 'Create')
      .map((command) => command.title)
    expect(palette.sort()).toEqual([...(strip as string[])].sort())
    for (const label of strip as string[]) expect(label).toMatch(/^[A-Z][a-z]+( [a-z]+)+$/)
  })
})
