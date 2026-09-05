import type { ConferenceDeadlineKind } from '../types/conference'

/**
 * Upstream UIDs are random on every feed regeneration (docs/upstream-ccf-feed.md), so identity is
 * derived from normalised fields, never from UID or array position. Two feeds in different
 * languages produce the same key for the same round.
 */

export const normalizeComment = (comment: string | undefined): string =>
  (comment ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

export const normalizeName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ')

export interface StableKeyInput {
  conferenceName: string
  conferenceYear?: number
  deadlineKind: ConferenceDeadlineKind
  comment?: string
}

export const stableKeyFor = (input: StableKeyInput): string =>
  [
    normalizeName(input.conferenceName),
    input.conferenceYear === undefined ? '' : String(input.conferenceYear),
    input.deadlineKind,
    normalizeComment(input.comment)
  ].join('|')
