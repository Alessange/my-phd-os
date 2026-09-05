import type { FollowIntention } from '../types/conference'

export const FOLLOW_INTENTION_LABELS: Readonly<Record<FollowIntention, string>> = {
  watching: 'Watching',
  considering: 'Considering',
  submitting: 'Submitting'
}

export const FOLLOW_INTENTION_DESCRIPTIONS: Readonly<Record<FollowIntention, string>> = {
  watching: 'Keep an eye on it; no submission planned yet.',
  considering: 'Weighing a submission.',
  submitting: 'Planning to submit to this round.'
}
