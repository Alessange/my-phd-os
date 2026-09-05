import * as warnings from '../../database/repositories/dismissedWarnings'
import * as settings from '../../database/repositories/settings'
import type { Handlers } from '../registry'
import { OK } from './shared'

export const settingsHandlers = {
  'settings:get': (_request, ctx) => settings.getSettingsBundle(ctx.db),
  'settings:update': (patch, ctx) => settings.patchSettings(ctx.db, patch),
  'settings:updateUi': (patch, ctx) => settings.patchUiState(ctx.db, patch),

  'settings:listDismissedWarnings': (_request, ctx) => warnings.listDismissedWarnings(ctx.db),
  'settings:dismissWarning': ({ key, payload }, ctx) =>
    warnings.dismissWarning(ctx.db, key, payload),
  'settings:restoreWarning': ({ key }, ctx) => {
    warnings.restoreWarning(ctx.db, key)
    return OK
  },
  'settings:clearDismissedWarnings': (_request, ctx) => {
    warnings.clearDismissedWarnings(ctx.db)
    return OK
  }
} satisfies Partial<Handlers>
