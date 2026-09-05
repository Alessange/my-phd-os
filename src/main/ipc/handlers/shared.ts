import { AppError } from '@shared/errors'
import type { OkResponse } from '@shared/types/common'

export const OK: OkResponse = { ok: true }

/** Placeholder for channels a feature agent implements later; never silent. */
export const notImplemented = (feature: string): never => {
  throw new AppError('NOT_IMPLEMENTED', `${feature} is not available in this build yet`, {
    entity: feature
  })
}
