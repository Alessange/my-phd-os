import { createContext, useContext } from 'react'
import { THEMES, type ThemeId } from '@shared/types/settings'

export type ResolvedTheme = 'light' | 'dark'

const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && (THEMES as readonly string[]).includes(value)

/**
 * The theme setting main put on the initial URL (`?theme=light|dark|system`, read from the
 * database before the window was created). `system` when absent or unknown. This lets the first
 * frame already use the persisted theme; `ThemeProvider` takes over once settings load.
 */
export const bootThemeSetting = (search: string = window.location.search): ThemeId => {
  const value = new URLSearchParams(search).get('theme')
  return isThemeId(value) ? value : 'system'
}

export const resolveThemeSetting = (theme: ThemeId, prefersDark: boolean): ResolvedTheme =>
  theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme

export const ThemeContext = createContext<ResolvedTheme>('light')

/** The theme actually applied (`system` already resolved through `prefers-color-scheme`). */
export const useResolvedTheme = (): ResolvedTheme => useContext(ThemeContext)

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

export const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_SCHEME_QUERY).matches
    : false

/** Applies `.dark` and `color-scheme` on `<html>`. Called before first render to avoid a flash, then by ThemeProvider. */
export const applyTheme = (theme: ResolvedTheme): void => {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  root.dataset.theme = theme
}
