import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type {
  CreatePersonalDeadlineInput,
  UpdatePersonalDeadlineInput
} from '@shared/schemas/personalDeadline'
import type {
  DeadlineCalendarLinkMode,
  LinkCalendarEventResult,
  PersonalDeadline
} from '@shared/types/personalDeadline'
import type { OkResponse } from '@shared/types/common'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'

export interface PersonalDeadlinesListFilter {
  includeCompleted?: boolean
}

export const usePersonalDeadlines = (
  filter?: PersonalDeadlinesListFilter
): UseQueryResult<PersonalDeadline[], unknown> =>
  useQuery({
    queryKey: queryKeys.personalDeadlines.list(filter),
    queryFn: () => api('personalDeadlines:list', filter)
  })

export const usePersonalDeadline = (id: string): UseQueryResult<PersonalDeadline, unknown> =>
  useQuery({
    queryKey: queryKeys.personalDeadlines.detail(id),
    queryFn: () => api('personalDeadlines:get', { id }),
    enabled: Boolean(id)
  })

export const useCreatePersonalDeadline = (): UseMutationResult<
  PersonalDeadline,
  unknown,
  CreatePersonalDeadlineInput,
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: CreatePersonalDeadlineInput) => api('personalDeadlines:create', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.personalDeadlines.all }),
    onError: (error, input) => toastError(error, { retry: () => mutation.mutate(input) })
  })
  return mutation
}

export const useUpdatePersonalDeadline = (): UseMutationResult<
  PersonalDeadline,
  unknown,
  { id: string; patch: UpdatePersonalDeadlineInput },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdatePersonalDeadlineInput }) =>
      api('personalDeadlines:update', { id, patch }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.personalDeadlines.all }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

export const useDeletePersonalDeadline = (): UseMutationResult<
  OkResponse,
  unknown,
  { id: string },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api('personalDeadlines:delete', { id }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.personalDeadlines.all }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

/** Set work progress 0–100; the backend clamps and recomputes status-derived fields. */
export const useSetDeadlineProgress = (): UseMutationResult<
  PersonalDeadline,
  unknown,
  { id: string; progress: number },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) =>
      api('personalDeadlines:setProgress', { id, progress }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.personalDeadlines.all }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

/**
 * Create a linked calendar event for a deadline. Invalidates both deadline and calendar queries:
 * a new event appears on the calendar, and the deadline row gains `linkedCalendarEventId`.
 */
export const useLinkCalendarEvent = (): UseMutationResult<
  LinkCalendarEventResult,
  unknown,
  { id: string; mode: DeadlineCalendarLinkMode },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: DeadlineCalendarLinkMode }) =>
      api('personalDeadlines:linkCalendarEvent', { id, mode }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.personalDeadlines.all })
      void client.invalidateQueries({ queryKey: queryKeys.calendar.all })
    },
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

/** Remove a deadline's linked calendar event (optionally deleting the event). */
export const useUnlinkCalendarEvent = (): UseMutationResult<
  PersonalDeadline,
  unknown,
  { id: string; deleteEvent: boolean },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, deleteEvent }: { id: string; deleteEvent: boolean }) =>
      api('personalDeadlines:unlinkCalendarEvent', { id, deleteEvent }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.personalDeadlines.all })
      void client.invalidateQueries({ queryKey: queryKeys.calendar.all })
    },
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

export type { PersonalDeadline, LinkCalendarEventResult, OkResponse }
