import { emptyRequestSchema } from '../../schemas/common'
import {
  dismissWarningRequestSchema,
  restoreWarningRequestSchema,
  updateSettingsInputSchema,
  updateUiStateInputSchema
} from '../../schemas/settings'
import type { OkResponse } from '../../types/common'
import type { AppSettings, DismissedWarning, SettingsBundle, UiState } from '../../types/settings'
import { defineChannel } from '../defineChannel'

export const settingsChannels = {
  'settings:get': defineChannel<typeof emptyRequestSchema, SettingsBundle>(
    'settings:get',
    emptyRequestSchema
  ),
  'settings:update': defineChannel<typeof updateSettingsInputSchema, AppSettings>(
    'settings:update',
    updateSettingsInputSchema
  ),
  'settings:updateUi': defineChannel<typeof updateUiStateInputSchema, UiState>(
    'settings:updateUi',
    updateUiStateInputSchema
  ),
  'settings:listDismissedWarnings': defineChannel<typeof emptyRequestSchema, DismissedWarning[]>(
    'settings:listDismissedWarnings',
    emptyRequestSchema
  ),
  'settings:dismissWarning': defineChannel<typeof dismissWarningRequestSchema, DismissedWarning>(
    'settings:dismissWarning',
    dismissWarningRequestSchema
  ),
  'settings:restoreWarning': defineChannel<typeof restoreWarningRequestSchema, OkResponse>(
    'settings:restoreWarning',
    restoreWarningRequestSchema
  ),
  'settings:clearDismissedWarnings': defineChannel<typeof emptyRequestSchema, OkResponse>(
    'settings:clearDismissedWarnings',
    emptyRequestSchema
  )
}
