import type { IsoInstant } from './common'

export const MILESTONE_CATEGORIES = [
  'coursework',
  'research',
  'publication',
  'phd_progress',
  'internship',
  'career',
  'personal',
  'other'
] as const
export type MilestoneCategory = (typeof MILESTONE_CATEGORIES)[number]

export const MILESTONE_STATUSES = ['not_started', 'in_progress', 'completed', 'delayed'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]

export interface Milestone {
  id: string
  title: string
  description?: string

  startAt: IsoInstant
  targetAt: IsoInstant

  category: MilestoneCategory
  status: MilestoneStatus

  /** Work completion, 0–100. */
  progress: number
  color?: string

  createdAt: IsoInstant
  updatedAt: IsoInstant
}
