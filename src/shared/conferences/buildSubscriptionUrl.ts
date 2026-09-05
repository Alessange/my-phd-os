import { encodeRankForUrl } from '../constants/ccf'
import { OFFICIAL_FEED_BASE } from '../constants/hosts'
import {
  CCF_RANKS,
  CCF_SUBJECT_CODES,
  CORE_RANKS,
  THCPL_RANKS,
  type CcfRank,
  type CcfSubjectCode,
  type CoreRank,
  type SubscriptionFilters,
  type SubscriptionLanguage,
  type ThcplRank
} from '../types/conference'

/**
 * Official CCF Deadlines filename convention (spec §12.1, docs/upstream-ccf-feed.md):
 * `deadlines_{lang}[_ccf_{R}][_core_{R}][_thcpl_{R}][_{SUBJECT}].ics`, filters in that fixed order,
 * `A*` written as `Astar`.
 */

export interface SubscriptionSpec {
  language: SubscriptionLanguage
  filters?: SubscriptionFilters
}

/** `deadlines_en_core_Astar_SE.ics` */
export const buildSubscriptionFileName = ({ language, filters = {} }: SubscriptionSpec): string => {
  const parts = [`deadlines_${language}`]
  if (filters.ccf) parts.push(`ccf_${encodeRankForUrl(filters.ccf)}`)
  if (filters.core) parts.push(`core_${encodeRankForUrl(filters.core)}`)
  if (filters.thcpl) parts.push(`thcpl_${encodeRankForUrl(filters.thcpl)}`)
  if (filters.subject) parts.push(filters.subject)
  return `${parts.join('_')}.ics`
}

export const buildSubscriptionUrl = (spec: SubscriptionSpec): string =>
  `${OFFICIAL_FEED_BASE}${buildSubscriptionFileName(spec)}`

const decodeRank = (segment: string): string => segment.replace(/star$/i, '*')

const isCcfRank = (v: string): v is CcfRank => (CCF_RANKS as readonly string[]).includes(v)
const isCoreRank = (v: string): v is CoreRank => (CORE_RANKS as readonly string[]).includes(v)
const isThcplRank = (v: string): v is ThcplRank => (THCPL_RANKS as readonly string[]).includes(v)
const isSubject = (v: string): v is CcfSubjectCode =>
  (CCF_SUBJECT_CODES as readonly string[]).includes(v)

/**
 * Recognises an official feed URL and recovers its language and filters; undefined for anything
 * that is not exactly an official filename (custom subscriptions keep their URL as the label).
 */
export const parseSubscriptionUrl = (url: string): SubscriptionSpec | undefined => {
  if (!url.startsWith(OFFICIAL_FEED_BASE)) return undefined
  const file = url.slice(OFFICIAL_FEED_BASE.length)
  const match = /^deadlines_(en|zh)((?:_[A-Za-z*]+)*)\.ics$/.exec(file)
  if (!match) return undefined
  const language = match[1] as SubscriptionLanguage
  const segments = match[2].split('_').filter(Boolean)
  const filters: SubscriptionFilters = {}
  let index = 0
  const takeRank = (key: 'ccf' | 'core' | 'thcpl', accept: (v: string) => boolean): boolean => {
    if (segments[index] !== key || segments[index + 1] === undefined) return false
    const rank = decodeRank(segments[index + 1])
    if (!accept(rank)) return false
    filters[key] = rank as never
    index += 2
    return true
  }
  takeRank('ccf', isCcfRank)
  takeRank('core', isCoreRank)
  takeRank('thcpl', isThcplRank)
  if (index < segments.length) {
    const subject = segments[index]
    if (!isSubject(subject)) return undefined
    filters.subject = subject
    index += 1
  }
  if (index !== segments.length) return undefined
  return { language, filters }
}

/** `CORE A*, TH-CPL B, SE` — empty string when unfiltered. */
export const describeFilters = (filters: SubscriptionFilters | undefined): string => {
  if (!filters) return ''
  const parts: string[] = []
  if (filters.ccf) parts.push(`CCF ${filters.ccf}`)
  if (filters.core) parts.push(`CORE ${filters.core}`)
  if (filters.thcpl) parts.push(`TH-CPL ${filters.thcpl}`)
  if (filters.subject) parts.push(filters.subject)
  return parts.join(', ')
}
