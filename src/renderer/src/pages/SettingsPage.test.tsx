import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useNavigation } from '@renderer/app/navigation'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { windowApi } from '../../../../tests/setup/renderer'
import SettingsPage from './SettingsPage'

describe('SettingsPage › General', () => {
  beforeEach(() => {
    useNavigation.setState({ page: 'settings', params: {}, hydrated: true })
  })

  it('renders the four sections with headings', async () => {
    renderWithProviders(<SettingsPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    for (const name of ['General', 'Conference Subscriptions', 'Data', 'About']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  it('persists the clock format through settings:update', async () => {
    renderWithProviders(<SettingsPage />)
    const group = await screen.findByRole('radiogroup', { name: 'Clock' })
    const twelveHour = screen.getByRole('radio', { name: '12-hour' })
    expect(group).toContainElement(twelveHour)
    expect(twelveHour).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(twelveHour)
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('settings:update', { clock: '12h' })
    )
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: '12-hour' })).toHaveAttribute('aria-checked', 'true')
    )
  })

  it('persists week start and launch behaviour', async () => {
    renderWithProviders(<SettingsPage />)
    await userEvent.click(await screen.findByRole('radio', { name: 'Sunday' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('settings:update', { weekStartsOn: 0 })
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Calendar' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('settings:update', { launchPage: 'calendar' })
    )
  })

  it('switches theme from the General section', async () => {
    renderWithProviders(<SettingsPage />)
    const themeGroup = await screen.findByRole('radiogroup', { name: 'Theme' })
    expect(themeGroup).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('settings:update', { theme: 'dark' })
    )
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))
  })

  it('shows the database path and version from app:getInfo', async () => {
    renderWithProviders(<SettingsPage />)
    expect(await screen.findByText('/tmp/my-phd-os-test/my-phd-os.sqlite')).toBeInTheDocument()
    expect(await screen.findByText('0.0.0-test')).toBeInTheDocument()
  })

  it('moves the section highlight when a deep link arrives while already on Settings', async () => {
    renderWithProviders(<SettingsPage />)
    const nav = await screen.findByRole('navigation', { name: 'Settings sections' })
    const button = (name: string): HTMLElement => {
      const found = Array.from(nav.querySelectorAll('button')).find((b) => b.textContent === name)
      if (!found) throw new Error(`no nav button ${name}`)
      return found
    }
    expect(button('General')).toHaveAttribute('aria-current', 'location')
    expect(button('About')).not.toHaveAttribute('aria-current')

    act(() => {
      useNavigation.getState().navigate('settings', { section: 'about' })
    })
    await waitFor(() => expect(button('About')).toHaveAttribute('aria-current', 'location'))
    expect(button('General')).not.toHaveAttribute('aria-current')

    act(() => {
      useNavigation.getState().navigate('settings', { section: 'data' })
    })
    await waitFor(() => expect(button('Data')).toHaveAttribute('aria-current', 'location'))
  })
})
