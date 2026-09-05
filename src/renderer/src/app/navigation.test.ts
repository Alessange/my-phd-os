import { beforeEach, describe, expect, it, vi } from 'vitest'
import { windowApi } from '../../../../tests/setup/renderer'
import { queryClient } from './queryClient'
import { PAGES, useNavigation } from './navigation'

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
