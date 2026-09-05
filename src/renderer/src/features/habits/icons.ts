import type { LucideIcon } from 'lucide-react'
import { iconByName } from '@renderer/lib/icons'

/**
 * Curated icon set for habits, stored by lucide component name. Every name is registered in
 * `lib/icons.ts`, so `DynamicIcon` renders a stored name back. `icon` is optional: a habit may
 * show only its colour.
 */
export const HABIT_ICON_NAMES = [
  'Award',
  'BookOpen',
  'Briefcase',
  'Coffee',
  'HeartPulse',
  'Repeat'
] as const

export interface HabitIconEntry {
  value: string
  label: string
  Icon: LucideIcon
}

export const HABIT_ICON_ENTRIES: HabitIconEntry[] = HABIT_ICON_NAMES.map((value) => ({
  value,
  label: value,
  Icon: iconByName(value)
}))
