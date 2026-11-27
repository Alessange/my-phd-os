import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge must know the six type roles (`text-meta ... text-hero`): unknown `text-*` names are
 * read as colours, so `cn('text-display', 'text-ink')` would silently drop the size.
 */
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['meta', 'body', 'lead', 'title', 'display', 'hero'] } }
})

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))

/**
 * Inline style that sets `--chip` to a theme colour token (`status-ahead`, `category-paper`,
 * `conference-3`), read as `text-(--chip)` by StatusMark. It references the raw `--<token>` custom property, not the
 * `--color-<token>` theme name: `@theme inline` resolves those at build time and never emits them
 * as runtime variables, so `var(--color-…)` resolves to nothing and the mark renders transparent.
 * The raw properties are declared for both themes, so this stays theme-aware.
 */
export const chipStyle = (colorToken: string): React.CSSProperties =>
  ({ '--chip': `var(--${colorToken})` }) as React.CSSProperties

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** 0–100, rounded; used by every progress display. */
export const clampPercent = (value: number): number => Math.min(100, Math.max(0, Math.round(value)))

const HEX_COLOUR = /^#(?:[0-9a-fA-F]{3}){1,2}$/

/**
 * A stored per-record colour (habit, calendar source: free-form `#rgb` / `#rrggbb`) normalised to the
 * design's shared lightness and chroma, keeping only its hue. Use it for the 6 px dot in editors and
 * the Calendars list, never for text, fills or grids (DESIGN.md section 2.2). Anything that is not a
 * hex falls back to ink-3. The stored value itself is never changed.
 */
export const userColor = (hex: string | null | undefined): string =>
  hex && HEX_COLOUR.test(hex) ? `oklch(from ${hex} var(--user-l) var(--user-c) h)` : 'var(--ink-3)'
