import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type {
  CommitIcsImportRequest,
  CreateCalendarEventInput,
  CreateCalendarSourceInput,
  ExportIcsRequest,
  ListEventsFilter,
  PreviewIcsImportRequest,
  UpdateCalendarEventInput,
  UpdateCalendarSourceInput
} from '@shared/schemas/calendar'
import type {
  CalendarEvent,
  CalendarSource,
  DeleteCalendarSourceResult,
  IcsExportResult,
  IcsImportPreview,
  IcsImportResult,
  IcsPickResult
} from '@shared/types/calendar'
import type { OkResponse } from '@shared/types/common'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'

/**
 * Calendar hooks. Events are fetched per visible range (the query key carries the filter);
 * mutations invalidate every calendar query. Dialog channels return `{ canceled: true }` as a value.
 */

export const useCalendarEvents = (
  filter: ListEventsFilter | undefined,
  options: { enabled?: boolean } = {}
): UseQueryResult<CalendarEvent[], unknown> =>
  useQuery({
    queryKey: queryKeys.calendar.events(filter),
    queryFn: () => api('calendar:listEvents', filter),
    enabled: options.enabled ?? true
  })

export const useCalendarSources = (): UseQueryResult<CalendarSource[], unknown> =>
  useQuery({
    queryKey: queryKeys.calendar.sources(),
    queryFn: () => api('calendar:listSources')
  })

const useCalendarMutation = <TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: { retry?: boolean } = {}
): UseMutationResult<TData, unknown, TVars, unknown> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.calendar.all }),
    onError: (error, vars) =>
      toastError(error, options.retry === false ? {} : { retry: () => mutation.mutate(vars) })
  })
  return mutation
}

export const useCreateEvent = (): UseMutationResult<
  CalendarEvent,
  unknown,
  CreateCalendarEventInput,
  unknown
> => useCalendarMutation((input: CreateCalendarEventInput) => api('calendar:createEvent', input))

export const useUpdateEvent = (): UseMutationResult<
  CalendarEvent,
  unknown,
  { id: string; patch: UpdateCalendarEventInput },
  unknown
> =>
  useCalendarMutation((vars: { id: string; patch: UpdateCalendarEventInput }) =>
    api('calendar:updateEvent', vars)
  )

export const useDeleteEvent = (): UseMutationResult<OkResponse, unknown, { id: string }, unknown> =>
  useCalendarMutation((vars: { id: string }) => api('calendar:deleteEvent', vars))

export const useCreateSource = (): UseMutationResult<
  CalendarSource,
  unknown,
  CreateCalendarSourceInput,
  unknown
> => useCalendarMutation((input: CreateCalendarSourceInput) => api('calendar:createSource', input))

export const useUpdateSource = (): UseMutationResult<
  CalendarSource,
  unknown,
  { id: string; patch: UpdateCalendarSourceInput },
  unknown
> =>
  useCalendarMutation((vars: { id: string; patch: UpdateCalendarSourceInput }) =>
    api('calendar:updateSource', vars)
  )

export const useDeleteSource = (): UseMutationResult<
  DeleteCalendarSourceResult,
  unknown,
  { id: string; deleteEvents: boolean },
  unknown
> =>
  useCalendarMutation((vars: { id: string; deleteEvents: boolean }) =>
    api('calendar:deleteSource', vars)
  )

/** Native picker; the files' names and text come back, nothing else crosses the bridge. */
export const usePickIcsFiles = (): UseMutationResult<IcsPickResult, unknown, void, unknown> => {
  const mutation = useMutation({
    mutationFn: () => api('calendar:pickIcsFiles'),
    onError: (error) => toastError(error, { retry: () => mutation.mutate() })
  })
  return mutation
}

export const usePreviewIcsImport = (): UseMutationResult<
  IcsImportPreview,
  unknown,
  PreviewIcsImportRequest,
  unknown
> => {
  const mutation = useMutation({
    mutationFn: (request: PreviewIcsImportRequest) => api('calendar:previewIcsImport', request),
    onError: (error, request) => toastError(error, { retry: () => mutation.mutate(request) })
  })
  return mutation
}

export const useCommitIcsImport = (): UseMutationResult<
  IcsImportResult,
  unknown,
  CommitIcsImportRequest,
  unknown
> =>
  useCalendarMutation(
    (request: CommitIcsImportRequest) => api('calendar:commitIcsImport', request),
    { retry: false }
  )

export const useExportIcs = (): UseMutationResult<
  IcsExportResult,
  unknown,
  ExportIcsRequest,
  unknown
> => {
  const mutation = useMutation({
    mutationFn: (request: ExportIcsRequest) => api('calendar:exportIcs', request),
    onError: (error, request) => toastError(error, { retry: () => mutation.mutate(request) })
  })
  return mutation
}

export type { CalendarEvent, CalendarSource }
