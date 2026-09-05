import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeCommand } from '@renderer/app/commandBus'
import { useNavigation } from '@renderer/app/navigation'
import {
  DEADLINES_QUICK_CREATE,
  triggerQuickCreate,
  useQuickCreateStore
} from '@renderer/app/quickCreate'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import DeadlinesPage from './DeadlinesPage'

describe('DeadlinesPage quick-create', () => {
  beforeEach(() => {
    useNavigation.setState({ page: 'deadlines', params: {}, hydrated: true })
    useQuickCreateStore.setState({ handlers: {} })
  })

  it('forwards quick-create to the active tab through the command bus', async () => {
    renderWithProviders(<DeadlinesPage />)
    await screen.findByRole('tab', { name: 'Conference Deadlines' })
    await waitFor(() =>
      expect(useQuickCreateStore.getState().handlers.deadlines).toBeInstanceOf(Function)
    )

    const conference = vi.fn()
    const personal = vi.fn()
    const offConference = subscribeCommand(DEADLINES_QUICK_CREATE.conference, conference)
    const offPersonal = subscribeCommand(DEADLINES_QUICK_CREATE.personal, personal)

    triggerQuickCreate()
    expect(conference).toHaveBeenCalledWith({ tab: 'conference' })
    expect(personal).not.toHaveBeenCalled()

    useNavigation.getState().navigate('deadlines', { tab: 'personal' })
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Personal Deadlines' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    )
    triggerQuickCreate()
    await waitFor(() => expect(personal).toHaveBeenCalledWith({ tab: 'personal' }))
    expect(conference).toHaveBeenCalledTimes(1)

    offConference()
    offPersonal()
  })
})
