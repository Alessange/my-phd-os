import { useEffect, type ReactNode } from 'react'
import { useMediaQuery } from '@renderer/hooks/useMediaQuery'
import { useSettings } from '@renderer/hooks/useSettings'
import { applyTheme, DARK_SCHEME_QUERY, ThemeContext, type ResolvedTheme } from './themeContext'

/**
 * Resolves `settings.theme` (light / dark / system) to a concrete theme and applies it to `<html>`.
 * Until settings load, `system` is assumed so the first paint already matches the OS.
 */
export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { settings, isLoaded } = useSettings()
  const prefersDark = useMediaQuery(DARK_SCHEME_QUERY)
  const theme = isLoaded ? settings.theme : 'system'
  const resolved: ResolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>
}
