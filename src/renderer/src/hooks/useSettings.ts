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

/** Optimistic settings write usable outside React (commands, shortcuts). Errors are toasted with Retry. */
export const persistSettings = async (
  patch: UpdateSettingsInput
): Promise<AppSettings | undefined> => {
  const previous = appQueryClient.getQueryData<SettingsBundle>(KEY)
  appQueryClient.setQueryData<SettingsBundle>(KEY, (bundle) => mergeSettings(bundle, patch))
  try {
    const settings = await api('settings:update', patch)
    appQueryClient.setQueryData<SettingsBundle>(KEY, (bundle) => ({
      settings,
      ui: bundle?.ui ?? DEFAULT_UI_STATE
    }))
    return settings
  } catch (error) {
    appQueryClient.setQueryData(KEY, previous)
    toastError(error, { title: 'Could not save settings', retry: () => persistSettings(patch) })
    return undefined
  }
}

/** Optimistic UI-state write (last page, sidebar, tabs). Failures are toasted; the cache rolls back. */
export const persistUi = async (patch: UpdateUiStateInput): Promise<UiState | undefined> => {
  const previous = appQueryClient.getQueryData<SettingsBundle>(KEY)
  appQueryClient.setQueryData<SettingsBundle>(KEY, (bundle) => mergeUi(bundle, patch))
  try {
    const ui = await api('settings:updateUi', patch)
    appQueryClient.setQueryData<SettingsBundle>(KEY, (bundle) => ({
      settings: bundle?.settings ?? DEFAULT_SETTINGS,
      ui
    }))
    return ui
  } catch (error) {
    appQueryClient.setQueryData(KEY, previous)
    toastError(error, {
      title: 'Could not save your layout preference',
      retry: () => persistUi(patch)
    })
    return undefined
  }
}

export interface UseSettingsResult {
  settings: AppSettings
  ui: UiState
  /** False until the first successful `settings:get`; defaults are shown meanwhile. */
  isLoaded: boolean
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
    isLoaded: query.data !== undefined,
    error: query.error,
    refetch,
    updateSettings: settingsMutation.mutateAsync,
    updateUi: uiMutation.mutateAsync,
    isSaving: settingsMutation.isPending || uiMutation.isPending
  }
}
