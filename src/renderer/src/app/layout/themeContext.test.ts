import { describe, expect, it } from 'vitest'
import { bootThemeSetting, resolveThemeSetting } from './themeContext'

describe('boot theme', () => {
  it('reads the theme main put on the initial URL and falls back to system', () => {
    expect(bootThemeSetting('?theme=dark')).toBe('dark')
    expect(bootThemeSetting('?dbError=1&theme=light')).toBe('light')
    expect(bootThemeSetting('?theme=system')).toBe('system')
    expect(bootThemeSetting('?theme=neon')).toBe('system')
    expect(bootThemeSetting('')).toBe('system')
  })

  it('resolves system through the OS preference and fixed themes directly', () => {
    expect(resolveThemeSetting('system', true)).toBe('dark')
    expect(resolveThemeSetting('system', false)).toBe('light')
    expect(resolveThemeSetting('light', true)).toBe('light')
    expect(resolveThemeSetting('dark', false)).toBe('dark')
  })
})
