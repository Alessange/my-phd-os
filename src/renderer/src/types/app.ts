import type { AppInfo } from '@shared/types/app'

/** `app:getInfo` response as consumed by the shell; `dbError` (shared `IpcError`) triggers the blocking database screen. */
export type AppInfoWithDbError = AppInfo
