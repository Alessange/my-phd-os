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
