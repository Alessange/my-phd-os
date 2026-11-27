import { describe, expect, it } from 'vitest'
import { cn, userColor } from './utils'

describe('cn', () => {
  it('keeps a type-role size next to a colour utility', () => {
    expect(cn('text-display', 'text-ink')).toBe('text-display text-ink')
    expect(cn('text-title', 'text-ink-2', 'text-hero')).toBe('text-ink-2 text-hero')
  })

  it('still lets a later colour win over an earlier one', () => {
    expect(cn('text-ink', 'text-signal')).toBe('text-signal')
  })
})

describe('userColor', () => {
  it('routes a stored hex through the shared lightness and chroma, keeping only its hue', () => {
    expect(userColor('#3b82f6')).toBe('oklch(from #3b82f6 var(--user-l) var(--user-c) h)')
    expect(userColor('#abc')).toBe('oklch(from #abc var(--user-l) var(--user-c) h)')
  })

  it('falls back to ink-3 for anything that is not a hex', () => {
    expect(userColor(undefined)).toBe('var(--ink-3)')
    expect(userColor('red')).toBe('var(--ink-3)')
  })
})
