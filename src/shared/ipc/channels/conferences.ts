import { emptyRequestSchema, idRequestSchema, patchRequest } from '../../schemas/common'
import {
  acknowledgeChangesRequestSchema,
  addSubscriptionRequestSchema,
  followRequestSchema,
  listChangesRequestSchema,
  listConferenceDeadlinesRequestSchema,
  refreshRequestSchema,
  updateFollowPatchSchema,
  updateSubscriptionPatchSchema
} from '../../schemas/conference'
import type { CalendarEvent } from '../../types/calendar'
import type { OkResponse } from '../../types/common'
import type {
  ConferenceDeadlineChangeView,
  ConferenceDeadlineView,
  ConferenceSubscription,
  FollowedConference,
  RefreshOutcome,
  RefreshStatus,
  RemoveSubscriptionResult
} from '../../types/conference'
import { defineChannel } from '../defineChannel'

const updateSubscriptionRequestSchema = patchRequest(updateSubscriptionPatchSchema)
const updateFollowRequestSchema = patchRequest(updateFollowPatchSchema)

export const conferenceChannels = {
  'conferences:listSubscriptions': defineChannel<
    typeof emptyRequestSchema,
    ConferenceSubscription[]
  >('conferences:listSubscriptions', emptyRequestSchema),
  'conferences:addSubscription': defineChannel<
    typeof addSubscriptionRequestSchema,
    ConferenceSubscription
  >('conferences:addSubscription', addSubscriptionRequestSchema),
  'conferences:updateSubscription': defineChannel<
    typeof updateSubscriptionRequestSchema,
    ConferenceSubscription
  >('conferences:updateSubscription', updateSubscriptionRequestSchema),
  'conferences:removeSubscription': defineChannel<typeof idRequestSchema, RemoveSubscriptionResult>(
    'conferences:removeSubscription',
    idRequestSchema
  ),
  'conferences:refresh': defineChannel<typeof refreshRequestSchema, RefreshOutcome[]>(
    'conferences:refresh',
    refreshRequestSchema
  ),
  'conferences:getRefreshStatus': defineChannel<typeof emptyRequestSchema, RefreshStatus>(
    'conferences:getRefreshStatus',
    emptyRequestSchema
  ),

  'conferences:listDeadlines': defineChannel<
    typeof listConferenceDeadlinesRequestSchema,
    ConferenceDeadlineView[]
  >('conferences:listDeadlines', listConferenceDeadlinesRequestSchema),
  'conferences:getDeadline': defineChannel<typeof idRequestSchema, ConferenceDeadlineView>(
    'conferences:getDeadline',
    idRequestSchema
  ),

  'conferences:follow': defineChannel<typeof followRequestSchema, FollowedConference>(
    'conferences:follow',
    followRequestSchema
  ),
  'conferences:unfollow': defineChannel<typeof idRequestSchema, OkResponse>(
    'conferences:unfollow',
    idRequestSchema
  ),
  'conferences:updateFollow': defineChannel<typeof updateFollowRequestSchema, FollowedConference>(
    'conferences:updateFollow',
    updateFollowRequestSchema
  ),
  'conferences:listFollowed': defineChannel<typeof emptyRequestSchema, ConferenceDeadlineView[]>(
    'conferences:listFollowed',
    emptyRequestSchema
  ),

  'conferences:addToCalendar': defineChannel<typeof idRequestSchema, CalendarEvent>(
    'conferences:addToCalendar',
    idRequestSchema
  ),
  'conferences:removeFromCalendar': defineChannel<typeof idRequestSchema, OkResponse>(
    'conferences:removeFromCalendar',
    idRequestSchema
  ),

  'conferences:listChanges': defineChannel<
    typeof listChangesRequestSchema,
    ConferenceDeadlineChangeView[]
  >('conferences:listChanges', listChangesRequestSchema),
  'conferences:acknowledgeChanges': defineChannel<
    typeof acknowledgeChangesRequestSchema,
    OkResponse
  >('conferences:acknowledgeChanges', acknowledgeChangesRequestSchema)
}
