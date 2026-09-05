import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { UpdateSettingsInput, UpdateUiStateInput } from '@shared/schemas/settings'
import {
  DEFAULT_SETTINGS,
  DEFAULT_UI_STATE,
  type AppSettings,
  type SettingsBundle,
  type UiState
} from '@shared/types/settings'
import { queryClient as appQueryClient } from '@renderer/app/queryClient'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'

const KEY = queryKeys.settings.bundle()

export const fetchSettings = (): Promise<SettingsBundle> => api('settings:get')

const mergeSettings = (
  bundle: SettingsBundle | undefined,
  patch: UpdateSettingsInput
): SettingsBundle => ({
  settings: { ...(bundle?.settings ?? DEFAULT_SETTINGS), ...patch },
  ui: bundle?.ui ?? DEFAULT_UI_STATE
})

const mergeUi = (
  bundle: SettingsBundle | undefined,
  patch: UpdateUiStateInput
): SettingsBundle => ({
  settings: bundle?.settings ?? DEFAULT_SETTINGS,
  ui: { ...(bundle?.ui ?? DEFAULT_UI_STATE), ...patch }
})

/**
 * Optimistic write shared by `persistSettings` / `persistUi`. Before the first `settings:get` has
 * populated the cache there is nothing to be optimistic about: seeding the cache with defaults
 * would flip `isLoaded` and hydrate the shell from defaults, so in that case the write is sent and
 * the bundle is (re)fetched afterwards instead.
 */
const optimisticWrite = async <T>(
  merge: (bundle: SettingsBundle | undefined) => SettingsBundle,
  send: () => Promise<T>,
  apply: (bundle: SettingsBundle, result: T) => SettingsBundle,
  failure: { title: string; retry: () => void }
): Promise<T | undefined> => {
  const previous = appQueryClient.getQueryData<SettingsBundle>(KEY)
  if (previous) appQueryClient.setQueryData<SettingsBundle>(KEY, merge(previous))
  try {
    const result = await send()
    const current = appQueryClient.getQueryData<SettingsBundle>(KEY)
    if (current) appQueryClient.setQueryData<SettingsBundle>(KEY, apply(current, result))
    else void appQueryClient.invalidateQueries({ queryKey: KEY })
    return result
  } catch (error) {
    if (previous) appQueryClient.setQueryData(KEY, previous)
    toastError(error, failure)
    return undefined
  }
}

/** Optimistic settings write usable outside React (commands, shortcuts). Errors are toasted with Retry. */
export const persistSettings = (patch: UpdateSettingsInput): Promise<AppSettings | undefined> =>
  optimisticWrite(
    (bundle) => mergeSettings(bundle, patch),
    () => api('settings:update', patch),
    (bundle, settings) => ({ settings, ui: bundle.ui }),
    { title: 'Could not save settings', retry: () => void persistSettings(patch) }
  )

/** Optimistic UI-state write (last page, sidebar, tabs). Failures are toasted; the cache rolls back. */
export const persistUi = (patch: UpdateUiStateInput): Promise<UiState | undefined> =>
  optimisticWrite(
    (bundle) => mergeUi(bundle, patch),
    () => api('settings:updateUi', patch),
    (bundle, ui) => ({ settings: bundle.settings, ui }),
    { title: 'Could not save your layout preference', retry: () => void persistUi(patch) }
  )

export interface UseSettingsResult {
  settings: AppSettings
  ui: UiState
  /** False until the first successful `settings:get`; defaults are shown meanwhile. */
  isLoaded: boolean
  /** `null` while loading or after success; the rejection otherwise. */
  error: unknown
  refetch: () => void
  updateSettings: (patch: UpdateSettingsInput) => Promise<AppSettings | undefined>
  updateUi: (patch: UpdateUiStateInput) => Promise<UiState | undefined>
  isSaving: boolean
}

export const useSettings = (): UseSettingsResult => {
  const client = useQueryClient()
  const query = useQuery({ queryKey: KEY, queryFn: fetchSettings, staleTime: Infinity })

  const settingsMutation = useMutation({ mutationFn: persistSettings })
  const uiMutation = useMutation({ mutationFn: persistUi })

  const refetch = useCallback(() => {
    void client.invalidateQueries({ queryKey: KEY })
  }, [client])

  return {
    settings: query.data?.settings ?? DEFAULT_SETTINGS,
    ui: query.data?.ui ?? DEFAULT_UI_STATE,
    isLoaded: query.isSuccess,
    error: query.error,
    refetch,
    updateSettings: settingsMutation.mutateAsync,
    updateUi: uiMutation.mutateAsync,
    isSaving: settingsMutation.isPending || uiMutation.isPending
  }
}
