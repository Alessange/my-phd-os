import { emptyRequestSchema } from '../../schemas/common'
import { logRequestSchema, openExternalRequestSchema } from '../../schemas/app'
import type { AppInfo } from '../../types/app'
import type { OkResponse } from '../../types/common'
import { defineChannel } from '../defineChannel'

export const appChannels = {
  'app:getInfo': defineChannel<typeof emptyRequestSchema, AppInfo>(
    'app:getInfo',
    emptyRequestSchema
  ),
  /** Retries opening + migrating the database after a startup failure; responds like `app:getInfo`. */
  'app:retryDatabase': defineChannel<typeof emptyRequestSchema, AppInfo>(
    'app:retryDatabase',
    emptyRequestSchema
  ),
  'app:openExternal': defineChannel<typeof openExternalRequestSchema, OkResponse>(
    'app:openExternal',
    openExternalRequestSchema
  ),
  'app:openDataDirectory': defineChannel<typeof emptyRequestSchema, OkResponse>(
    'app:openDataDirectory',
    emptyRequestSchema
  ),
  'app:log': defineChannel<typeof logRequestSchema, OkResponse>('app:log', logRequestSchema)
}
