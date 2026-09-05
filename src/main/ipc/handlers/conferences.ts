import { AppError } from '@shared/errors'
import { APPROVED_SUBSCRIPTION_HOSTS, isApprovedSubscriptionUrl } from '@shared/constants/hosts'
import type { RefreshStatus, SubscriptionRefreshState } from '@shared/types/conference'
import * as changes from '../../database/repositories/conferenceChanges'
import * as deadlines from '../../database/repositories/conferenceDeadlines'
import * as subscriptions from '../../database/repositories/conferenceSubscriptions'
import * as follows from '../../database/repositories/followedConferences'
import type { Handlers } from '../registry'
import { OK, notImplemented } from './shared'

/** `deadlines_en_ccf_A.ics` → `deadlines_en_ccf_A`; falls back to the host name. */
const defaultLabel = (url: URL): string => {
  const file = url.pathname.split('/').filter(Boolean).pop() ?? ''
  return file.replace(/\.ics$/i, '') || url.host
}

const maxInstant = (values: Array<string | undefined>): string | undefined =>
  values
    .filter((v): v is string => typeof v === 'string')
    .sort()
    .pop()

export const conferenceHandlers = {
  'conferences:listSubscriptions': (_request, ctx) => subscriptions.listSubscriptions(ctx.db),

  'conferences:addSubscription': (request, ctx) => {
    const url = new URL(request.url)
    const approved = isApprovedSubscriptionUrl(request.url)
    if (!approved && request.confirmCustom !== true) {
      throw new AppError(
        'UNTRUSTED_HOST',
        `${url.host} is not an approved conference source. Confirm that you trust this custom URL before adding it.`,
        { host: url.host, approvedHosts: APPROVED_SUBSCRIPTION_HOSTS }
      )
    }
    return subscriptions.createSubscription(ctx.db, {
      url: request.url,
      label: request.label?.trim() || defaultLabel(url),
      kind: approved ? request.kind : 'custom',
      language: request.language,
      filters: request.filters,
      customConfirmedAt: approved ? undefined : ctx.now()
    })
  },

  'conferences:updateSubscription': ({ id, patch }, ctx) =>
    subscriptions.updateSubscription(ctx.db, id, patch),
  'conferences:removeSubscription': ({ id }, ctx) => subscriptions.removeSubscription(ctx.db, id),

  // Owned by the conferences feature agent (src/main/subscriptions/**).
  'conferences:refresh': () => notImplemented('Refreshing conference subscriptions'),

  /** Derived from what fetches have actually recorded; nothing is running until the fetcher exists. */
  'conferences:getRefreshStatus': (_request, ctx): RefreshStatus => {
    const rows = subscriptions.listSubscriptions(ctx.db)
    const perSubscription: Record<string, SubscriptionRefreshState> = {}
    for (const row of rows) {
      perSubscription[row.id] = {
        subscriptionId: row.id,
        inProgress: false,
        lastSuccessAt: row.lastSuccessAt,
        lastAttemptAt: row.lastAttemptAt,
        lastError: row.lastError
      }
    }
    const latestFailure = rows
      .map((row) => row.lastError)
      .filter((e): e is NonNullable<typeof e> => !!e)
      .sort((a, b) => a.at.localeCompare(b.at))
      .pop()
    return {
      inProgress: false,
      lastSuccessAt: maxInstant(rows.map((row) => row.lastSuccessAt)),
      lastAttemptAt: maxInstant(rows.map((row) => row.lastAttemptAt)),
      lastError: latestFailure,
      perSubscription
    }
  },

  'conferences:listDeadlines': (filter, ctx) => deadlines.listConferenceDeadlines(ctx.db, filter),
  'conferences:getDeadline': ({ id }, ctx) => deadlines.getConferenceDeadlineView(ctx.db, id),

  'conferences:follow': ({ id, intention }, ctx) => follows.followConference(ctx.db, id, intention),
  'conferences:unfollow': ({ id }, ctx) => {
    follows.unfollowConference(ctx.db, id)
    return OK
  },
  'conferences:updateFollow': ({ id, patch }, ctx) => follows.updateFollow(ctx.db, id, patch),
  'conferences:listFollowed': (_request, ctx) => deadlines.listFollowedDeadlines(ctx.db),

  'conferences:addToCalendar': () => notImplemented('Adding a conference deadline to the calendar'),
  'conferences:removeFromCalendar': () =>
    notImplemented('Removing a conference deadline from the calendar'),

  'conferences:listChanges': (filter, ctx) => changes.listConferenceChanges(ctx.db, filter),
  'conferences:acknowledgeChanges': ({ ids }, ctx) => {
    changes.acknowledgeConferenceChanges(ctx.db, ids)
    return OK
  }
} satisfies Partial<Handlers>
