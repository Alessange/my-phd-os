import { useEffect, type ReactNode } from 'react'
import { useMediaQuery } from '@renderer/hooks/useMediaQuery'
import { useSettings } from '@renderer/hooks/useSettings'
import {
  applyTheme,
  bootThemeSetting,
  DARK_SCHEME_QUERY,
  resolveThemeSetting,
  ThemeContext
} from './themeContext'

/**
 * Resolves `settings.theme` (light / dark / system) to a concrete theme and applies it to `<html>`.
 * Until settings load, the theme main passed on the initial URL is used (the persisted setting),
 * so the first paint already matches what the user chose; `system` follows the OS.
 */
export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { settings, isLoaded } = useSettings()
  const prefersDark = useMediaQuery(DARK_SCHEME_QUERY)
  const theme = isLoaded ? settings.theme : bootThemeSetting()
  const resolved = resolveThemeSetting(theme, prefersDark)

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>
}
