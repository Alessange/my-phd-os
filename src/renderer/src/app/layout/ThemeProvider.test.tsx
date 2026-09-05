import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE } from '@shared/types/settings'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { setMediaQuery, windowApi } from '../../../../../tests/setup/renderer'
import { DARK_SCHEME_QUERY, useResolvedTheme } from './themeContext'

function Probe(): React.JSX.Element {
  return <span data-testid="theme">{useResolvedTheme()}</span>
}

describe('ThemeProvider', () => {
  it('applies .dark and color-scheme for the "dark" setting', async () => {
    windowApi.respond('settings:get', {
      settings: { ...DEFAULT_SETTINGS, theme: 'dark' },
      ui: DEFAULT_UI_STATE
    })
    renderWithProviders(<Probe />)
    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('removes .dark for the "light" setting', async () => {
    windowApi.respond('settings:get', {
      settings: { ...DEFAULT_SETTINGS, theme: 'light' },
      ui: DEFAULT_UI_STATE
    })
    renderWithProviders(<Probe />)
    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('follows prefers-color-scheme for "system" and reacts to changes', async () => {
    setMediaQuery(DARK_SCHEME_QUERY, true)
    windowApi.respond('settings:get', {
      settings: { ...DEFAULT_SETTINGS, theme: 'system' },
      ui: DEFAULT_UI_STATE
    })
    renderWithProviders(<Probe />)
    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    setMediaQuery(DARK_SCHEME_QUERY, false)
    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
