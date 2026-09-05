import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { useEffect } from 'react'
import type {
  AddSubscriptionRequest,
  ListChangesRequest,
  ListConferenceDeadlinesRequest,
  RefreshRequest,
  UpdateFollowPatch,
  UpdateSubscriptionPatch
} from '@shared/schemas/conference'
import type { CalendarEvent } from '@shared/types/calendar'
import type { OkResponse } from '@shared/types/common'
import type {
  ConferenceDeadlineChangeView,
  ConferenceDeadlineView,
  ConferenceSubscription,
  FollowedConference,
  RefreshOutcome,
  RefreshStatus,
  RemoveSubscriptionResult
} from '@shared/types/conference'
import { api, onEvent } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'

/**
 * Conference deadline hooks. All fetching happens in the main process; the renderer only reads
 * cached records and asks for a refresh. `conferences:refreshStatus` pushes keep the status query
 * live while a refresh runs.
 */

export const useSubscriptions = (): UseQueryResult<ConferenceSubscription[], unknown> =>
  useQuery({
    queryKey: queryKeys.conferences.subscriptions(),
    queryFn: () => api('conferences:listSubscriptions')
  })

export const useRefreshStatus = (): UseQueryResult<RefreshStatus, unknown> => {
  const client = useQueryClient()
  useEffect(
    () =>
      onEvent('conferences:refreshStatus', (status) => {
        client.setQueryData(queryKeys.conferences.refreshStatus(), status)
      }),
    [client]
  )
  return useQuery({
    queryKey: queryKeys.conferences.refreshStatus(),
    queryFn: () => api('conferences:getRefreshStatus')
  })
}

export const useConferenceDeadlines = (
  filter?: ListConferenceDeadlinesRequest
): UseQueryResult<ConferenceDeadlineView[], unknown> =>
  useQuery({
    queryKey: queryKeys.conferences.deadlines(filter),
    queryFn: () => api('conferences:listDeadlines', filter)
  })

export const useFollowedConferences = (): UseQueryResult<ConferenceDeadlineView[], unknown> =>
  useQuery({
    queryKey: queryKeys.conferences.followed(),
    queryFn: () => api('conferences:listFollowed')
  })

export const useConferenceChanges = (
  filter?: ListChangesRequest
): UseQueryResult<ConferenceDeadlineChangeView[], unknown> =>
  useQuery({
    queryKey: queryKeys.conferences.changes(filter),
    queryFn: () => api('conferences:listChanges', filter)
  })

const useConferenceMutation = <TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: { alsoCalendar?: boolean; toast?: boolean } = {}
): UseMutationResult<TData, unknown, TVars, unknown> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.conferences.all })
      if (options.alsoCalendar) void client.invalidateQueries({ queryKey: queryKeys.calendar.all })
    },
    onError: (error, vars) => {
      if (options.toast === false) return
      toastError(error, { retry: () => mutation.mutate(vars) })
    }
  })
  return mutation
}

/** Errors are surfaced by the builder (an untrusted host needs a confirmation, not a toast). */
export const useAddSubscription = (): UseMutationResult<
  ConferenceSubscription,
  unknown,
  AddSubscriptionRequest,
  unknown
> =>
  useConferenceMutation(
    (request: AddSubscriptionRequest) => api('conferences:addSubscription', request),
    {
      toast: false
    }
  )

export const useUpdateSubscription = (): UseMutationResult<
  ConferenceSubscription,
  unknown,
  { id: string; patch: UpdateSubscriptionPatch },
  unknown
> =>
  useConferenceMutation((vars: { id: string; patch: UpdateSubscriptionPatch }) =>
    api('conferences:updateSubscription', vars)
  )

export const useRemoveSubscription = (): UseMutationResult<
  RemoveSubscriptionResult,
  unknown,
  { id: string },
  unknown
> =>
  useConferenceMutation((vars: { id: string }) => api('conferences:removeSubscription', vars), {
    alsoCalendar: true
  })

/** "Refresh now": one subscription or all; failures come back as outcomes, so no toast is needed. */
export const useRefreshNow = (): UseMutationResult<
  RefreshOutcome[],
  unknown,
  RefreshRequest,
  unknown
> =>
  useConferenceMutation((request: RefreshRequest) => api('conferences:refresh', request), {
    alsoCalendar: true
  })

export const useFollow = (): UseMutationResult<
  FollowedConference,
  unknown,
  { id: string; intention?: FollowedConference['intention'] },
  unknown
> =>
  useConferenceMutation((vars: { id: string; intention?: FollowedConference['intention'] }) =>
    api('conferences:follow', vars)
  )

export const useUnfollow = (): UseMutationResult<OkResponse, unknown, { id: string }, unknown> =>
  useConferenceMutation((vars: { id: string }) => api('conferences:unfollow', vars), {
    alsoCalendar: true
  })

export const useUpdateFollow = (): UseMutationResult<
  FollowedConference,
  unknown,
  { id: string; patch: UpdateFollowPatch },
  unknown
> =>
  useConferenceMutation((vars: { id: string; patch: UpdateFollowPatch }) =>
    api('conferences:updateFollow', vars)
  )

export const useAddToCalendar = (): UseMutationResult<
  CalendarEvent,
  unknown,
  { id: string },
  unknown
> =>
  useConferenceMutation((vars: { id: string }) => api('conferences:addToCalendar', vars), {
    alsoCalendar: true
  })

export const useRemoveFromCalendar = (): UseMutationResult<
  OkResponse,
  unknown,
  { id: string },
  unknown
> =>
  useConferenceMutation((vars: { id: string }) => api('conferences:removeFromCalendar', vars), {
    alsoCalendar: true
  })

export const useAcknowledgeChanges = (): UseMutationResult<
  OkResponse,
  unknown,
  { ids: string[] },
  unknown
> => useConferenceMutation((vars: { ids: string[] }) => api('conferences:acknowledgeChanges', vars))

export type { ConferenceDeadlineView, ConferenceSubscription, RefreshStatus }

/** One conference by id (deep links to a conference that is not followed). */
export const useConferenceDeadline = (
  id: string | undefined
): UseQueryResult<ConferenceDeadlineView, unknown> =>
  useQuery({
    queryKey: queryKeys.conferences.deadline(id ?? ''),
    queryFn: () => api('conferences:getDeadline', { id: id as string }),
    enabled: id !== undefined
  })
