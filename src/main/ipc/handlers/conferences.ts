import { AppError } from '@shared/errors'
import { APPROVED_SUBSCRIPTION_HOSTS, isApprovedSubscriptionUrl } from '@shared/constants/hosts'
import * as changes from '../../database/repositories/conferenceChanges'
import * as deadlines from '../../database/repositories/conferenceDeadlines'
import * as subscriptions from '../../database/repositories/conferenceSubscriptions'
import * as follows from '../../database/repositories/followedConferences'
import {
  addConferenceToCalendar,
  removeConferenceFromCalendar
} from '../../subscriptions/calendarSync'
import { scheduler } from '../../subscriptions/scheduler'
import type { Handlers } from '../registry'
import { OK } from './shared'

/** `deadlines_en_ccf_A.ics` → `deadlines_en_ccf_A`; falls back to the host name. */
const defaultLabel = (url: URL): string => {
  const file = url.pathname.split('/').filter(Boolean).pop() ?? ''
  return file.replace(/\.ics$/i, '') || url.host
}

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

  /** Manual refresh ("Refresh now"); the scheduler owns in-progress state and status pushes. */
  'conferences:refresh': (request) => scheduler.refreshNow(request ?? {}),
  'conferences:getRefreshStatus': (_request, ctx) => scheduler.status(ctx.db),

  'conferences:listDeadlines': (filter, ctx) => deadlines.listConferenceDeadlines(ctx.db, filter),
  'conferences:getDeadline': ({ id }, ctx) => deadlines.getConferenceDeadlineView(ctx.db, id),

  'conferences:follow': ({ id, intention }, ctx) => follows.followConference(ctx.db, id, intention),
  'conferences:unfollow': ({ id }, ctx) => {
    // Unfollowing also takes the deadline off the calendar; the canonical record stays cached.
    removeConferenceFromCalendar(ctx.db, id)
    follows.unfollowConference(ctx.db, id)
    return OK
  },
  'conferences:updateFollow': ({ id, patch }, ctx) => follows.updateFollow(ctx.db, id, patch),
  'conferences:listFollowed': (_request, ctx) => deadlines.listFollowedDeadlines(ctx.db),

  'conferences:addToCalendar': ({ id }, ctx) => addConferenceToCalendar(ctx.db, id),
  'conferences:removeFromCalendar': ({ id }, ctx) => {
    removeConferenceFromCalendar(ctx.db, id)
    return OK
  },

  'conferences:listChanges': (filter, ctx) => changes.listConferenceChanges(ctx.db, filter),
  'conferences:acknowledgeChanges': ({ ids }, ctx) => {
    changes.acknowledgeConferenceChanges(ctx.db, ids)
    return OK
  }
} satisfies Partial<Handlers>
