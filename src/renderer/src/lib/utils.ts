import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))

/** Inline style that points the `chip-tint` utility at a theme colour token (`status-ahead`, `category-paper`). */
export const chipStyle = (colorToken: string): React.CSSProperties =>
  ({ '--chip': `var(--color-${colorToken})` }) as React.CSSProperties

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** 0–100, rounded; used by every progress display. */
export const clampPercent = (value: number): number => Math.min(100, Math.max(0, Math.round(value)))
