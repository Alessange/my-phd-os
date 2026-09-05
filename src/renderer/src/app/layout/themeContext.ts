import { createContext, useContext } from 'react'

export type ResolvedTheme = 'light' | 'dark'

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
