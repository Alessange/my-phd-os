/** Origins that may be fetched automatically without a custom-source confirmation. */
export const APPROVED_SUBSCRIPTION_HOSTS: readonly string[] = ['https://ccfddl.com']

export const OFFICIAL_FEED_BASE = 'https://ccfddl.com/conference/'

export const OFFICIAL_FEED_URLS = {
  en: `${OFFICIAL_FEED_BASE}deadlines_en.ics`,
  zh: `${OFFICIAL_FEED_BASE}deadlines_zh.ics`
} as const

export const CCF_DEADLINES_HOMEPAGE = 'https://ccfddl.com'
export const CCF_DEADLINES_REPOSITORY = 'https://github.com/ccfddl/ccf-deadlines'

/** True when `url` is an `https:` URL whose origin is an approved official host. */
export const isApprovedSubscriptionUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && APPROVED_SUBSCRIPTION_HOSTS.includes(parsed.origin)
  } catch {
    // An unparsable string is simply not an approved URL; callers validate URLs separately.
    return false
  }
}
