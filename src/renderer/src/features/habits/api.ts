import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { CreateHabitInput, UpdateHabitInput } from '@shared/schemas/habit'
import type { Habit, HabitCompletion } from '@shared/types/habit'
import type { OkResponse } from '@shared/types/common'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'

export interface HabitsListFilter {
  includeArchived?: boolean
}

export interface CompletionsRange {
  from: string
  to: string
}

export const useHabits = (filter?: HabitsListFilter): UseQueryResult<Habit[], unknown> =>
  useQuery({
    queryKey: queryKeys.habits.list(filter),
    queryFn: () => api('habits:list', filter)
  })

export const useHabitCompletions = (
  range: CompletionsRange
): UseQueryResult<HabitCompletion[], unknown> =>
  useQuery({
    queryKey: queryKeys.habits.completions(range),
    queryFn: () => api('habits:listCompletions', range)
  })

export const useCreateHabit = (): UseMutationResult<Habit, unknown, CreateHabitInput, unknown> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: CreateHabitInput) => api('habits:create', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.habits.all }),
    onError: (error, input) => toastError(error, { retry: () => mutation.mutate(input) })
  })
  return mutation
}

export const useUpdateHabit = (): UseMutationResult<
  Habit,
  unknown,
  { id: string; patch: UpdateHabitInput },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateHabitInput }) =>
      api('habits:update', { id, patch }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.habits.all }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

export const useSetArchived = (): UseMutationResult<
  Habit,
  unknown,
  { id: string; archived: boolean },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api('habits:setArchived', { id, archived }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.habits.all }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

export const useDeleteHabit = (): UseMutationResult<
  OkResponse,
  unknown,
  { id: string },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api('habits:delete', { id }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.habits.all }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

/** Toggle a completion; `completed` is the desired state after the toggle. */
export const useSetCompletion = (): UseMutationResult<
  HabitCompletion,
  unknown,
  { habitId: string; date: string; completed: boolean },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { habitId: string; date: string; completed: boolean }) =>
      api('habits:setCompletion', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.habits.all }),
    onError: (error, vars) => toastError(error, { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

export type { Habit, HabitCompletion, OkResponse }
