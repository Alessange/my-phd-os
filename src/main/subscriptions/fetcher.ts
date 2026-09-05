import { createHash } from 'node:crypto'
import { isApprovedSubscriptionUrl } from '@shared/constants/hosts'
import { AppError } from '@shared/errors'

/**
 * The only module in the application that talks to the network (ARCHITECTURE §0). It fetches one
 * `.ics` subscription with conditional headers and a timeout; the request carries nothing but the
 * URL, `Accept`, and the ETag / Last-Modified validators from the previous fetch. Only approved
 * hosts are fetched automatically; a custom host needs `allowCustomHost` (the user confirmed it).
 */

export interface FetchFeedOptions {
  etag?: string
  lastModified?: string
  timeoutMs: number
  allowCustomHost?: boolean
  /** Injected in tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
}

export type FetchFeedResult =
  | { status: 'notModified' }
  | {
      status: 'ok'
      text: string
      etag?: string
      lastModified?: string
      contentHash: string
    }

export const hashContent = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex')

const looksLikeCalendar = (text: string): boolean => /BEGIN:VCALENDAR/i.test(text.slice(0, 4096))

const assertTrustedUrl = (url: string, allowCustomHost: boolean | undefined): URL => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AppError('INVALID_URL', 'The subscription URL is not a valid URL', { url })
  }
  if (parsed.protocol !== 'https:') {
    throw new AppError('INVALID_URL', 'Subscriptions must use https', { host: parsed.host })
  }
  if (!isApprovedSubscriptionUrl(url) && !allowCustomHost) {
    throw new AppError(
      'UNTRUSTED_HOST',
      `${parsed.host} is not an approved conference source and was not confirmed`,
      { host: parsed.host }
    )
  }
  return parsed
}

export const fetchFeed = async (
  url: string,
  options: FetchFeedOptions
): Promise<FetchFeedResult> => {
  const target = assertTrustedUrl(url, options.allowCustomHost)
  const headers: Record<string, string> = {
    Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1'
  }
  if (options.etag) headers['If-None-Match'] = options.etag
  if (options.lastModified) headers['If-Modified-Since'] = options.lastModified

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)
  const doFetch = options.fetchImpl ?? fetch
  try {
    let response: Response
    try {
      response = await doFetch(target.href, {
        headers,
        signal: controller.signal,
        redirect: 'follow',
        cache: 'no-store'
      })
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AppError(
          'TIMEOUT',
          `${target.host} did not answer within ${Math.round(options.timeoutMs / 1000)} seconds`,
          { host: target.host }
        )
      }
      throw new AppError(
        'NETWORK',
        `Could not reach ${target.host}: ${error instanceof Error ? error.message : String(error)}`,
        { host: target.host }
      )
    }
    // A redirect must not smuggle the request to an unapproved host.
    if (response.url && response.url !== target.href)
      assertTrustedUrl(response.url, options.allowCustomHost)
    if (response.status === 304) return { status: 'notModified' }
    if (!response.ok) {
      throw new AppError('NETWORK', `${target.host} answered HTTP ${response.status}`, {
        host: target.host,
        status: response.status
      })
    }
    let text: string
    try {
      text = await response.text()
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AppError('TIMEOUT', `Downloading from ${target.host} took too long`, {
          host: target.host
        })
      }
      throw new AppError(
        'NETWORK',
        `Download from ${target.host} failed: ${error instanceof Error ? error.message : String(error)}`,
        { host: target.host }
      )
    }
    if (!looksLikeCalendar(text)) {
      throw new AppError('INVALID_ICS', `${target.host} did not return an iCalendar file`, {
        host: target.host
      })
    }
    return {
      status: 'ok',
      text,
      etag: response.headers.get('etag') ?? undefined,
      lastModified: response.headers.get('last-modified') ?? undefined,
      contentHash: hashContent(text)
    }
  } finally {
    clearTimeout(timer)
  }
}
