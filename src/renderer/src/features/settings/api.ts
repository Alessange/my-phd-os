import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { RequestInputOf, ResponseOf } from '@shared/ipc/contract'
import type { OkResponse } from '@shared/types/common'
import {
  CLEAR_ALL_DATA_CONFIRMATION,
  type BackupExportResult,
  type BackupImportMode,
  type BackupImportPreview,
  type BackupImportResult,
  type StorageInfo
} from '@shared/types/data'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'

/**
 * Settings › Data hooks. Dialog channels return `{ canceled: true }` as a value, so cancelling is
 * never an error; failures toast with Retry. Imports and clears touch every entity, so their
 * success invalidates the whole cache (main also broadcasts `data:changed`).
 */

export const useStorageInfo = (): UseQueryResult<StorageInfo, unknown> =>
  useQuery({
    queryKey: queryKeys.data.storageInfo(),
    queryFn: () => api('data:getStorageInfo')
  })

export const useOpenDataDirectory = (): UseMutationResult<OkResponse, unknown, void, unknown> => {
  const mutation = useMutation({
    mutationFn: () => api('app:openDataDirectory'),
    onError: (error) => toastError(error, { retry: () => mutation.mutate() })
  })
  return mutation
}

export const useExportBackup = (): UseMutationResult<
  BackupExportResult,
  unknown,
  void,
  unknown
> => {
  const mutation = useMutation({
    mutationFn: () => api('data:exportBackup'),
    onError: (error) => toastError(error, { retry: () => mutation.mutate() })
  })
  return mutation
}

export const usePreviewBackupImport = (): UseMutationResult<
  BackupImportPreview,
  unknown,
  void,
  unknown
> => {
  const mutation = useMutation({
    mutationFn: () => api('data:previewBackupImport'),
    onError: (error) => toastError(error, { retry: () => mutation.mutate() })
  })
  return mutation
}

export const useCommitBackupImport = (): UseMutationResult<
  BackupImportResult,
  unknown,
  { previewToken: string; mode: BackupImportMode },
  unknown
> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { previewToken: string; mode: BackupImportMode }) =>
      api('data:commitBackupImport', input),
    onSuccess: () => client.invalidateQueries(),
    // A used or expired preview token cannot be retried; the user picks the file again instead.
    onError: (error) => toastError(error)
  })
  return mutation
}

export const useClearAllData = (): UseMutationResult<OkResponse, unknown, void, unknown> => {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api('data:clearAllData', { confirmation: CLEAR_ALL_DATA_CONFIRMATION }),
    onSuccess: () => client.invalidateQueries(),
    onError: (error) => toastError(error, { retry: () => mutation.mutate() })
  })
  return mutation
}

export type ExportCalendarRequest = RequestInputOf<'calendar:exportIcs'>
export type ExportCalendarResult = ResponseOf<'calendar:exportIcs'>

export const useExportCalendar = (): UseMutationResult<
  ExportCalendarResult,
  unknown,
  ExportCalendarRequest,
  unknown
> => {
  const mutation = useMutation({
    mutationFn: (input: ExportCalendarRequest) => api('calendar:exportIcs', input),
    onError: (error, input) => toastError(error, { retry: () => mutation.mutate(input) })
  })
  return mutation
}
