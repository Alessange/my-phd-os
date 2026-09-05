import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { CreateMilestoneInput, UpdateMilestoneInput } from '@shared/schemas/milestone'
import type { DismissedWarning } from '@shared/types/settings'
import type { Milestone } from '@shared/types/milestone'
import type { OkResponse } from '@shared/types/common'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'

/**
 * The timeline warns-and-milestones layer. Milestone CRUD mirrors the habits api; the dismissed-
 * warning hooks live here too because the timeline warnings panel is their only consumer today
 * (the Settings > Data shell owns storage/backup, not warning dismissal).
 */

export const useMilestones = (): UseQueryResult<Milestone[], unknown> =>
  useQuery({
    queryKey: queryKeys.milestones.list(),
    queryFn: () => api('milestones:list')
  })

export const useMilestone = (id: string): UseQueryResult<Milestone, unknown> =>
  useQuery({
    queryKey: queryKeys.milestones.detail(id),
    queryFn: () => api('milestones:get', { id }),
    enabled: Boolean(id)
  })

export const useCreateMilestone = (): UseMutationResult<
  Milestone,
  unknown,
  CreateMilestoneInput,
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: CreateMilestoneInput) => api('milestones:create', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.milestones.all }),
    onError: (error, input) => toastError(error, { retry: () => mutation.mutate(input) })
  })
  return mutation
}

export const useUpdateMilestone = (): UseMutationResult<
  Milestone,
  unknown,
  { id: string; patch: UpdateMilestoneInput },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateMilestoneInput }) =>
      api('milestones:update', { id, patch }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.milestones.all }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

export const useDeleteMilestone = (): UseMutationResult<
  OkResponse,
  unknown,
  { id: string },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api('milestones:delete', { id }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.milestones.all }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

/** Dismissed timeline warnings (stable `key` → record). Used to hide a warning the user cleared. */
export const useDismissedWarnings = (): UseQueryResult<DismissedWarning[], unknown> =>
  useQuery({
    queryKey: queryKeys.settings.dismissedWarnings(),
    queryFn: () => api('settings:listDismissedWarnings')
  })

/** Dismiss a warning by its stable `key` (see `detectTimelineWarnings`); payload is optional context. */
export const useDismissWarning = (): UseMutationResult<
  DismissedWarning,
  unknown,
  { key: string; payload?: unknown },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { key: string; payload?: unknown }) =>
      api('settings:dismissWarning', input),
    // Precise: only the dismissed-warnings query changes, not the settings bundle.
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.settings.dismissedWarnings() }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

/** Bring a dismissed warning back. */
export const useRestoreWarning = (): UseMutationResult<
  OkResponse,
  unknown,
  { key: string },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { key: string }) => api('settings:restoreWarning', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.settings.dismissedWarnings() }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

export type { Milestone, DismissedWarning, OkResponse }
