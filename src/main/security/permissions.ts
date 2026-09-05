import type { Session } from 'electron'
import { logger } from '../logging/logger'

/**
 * Permissions the renderer may be granted. Empty on purpose: the app uses no camera, microphone,
 * geolocation, notifications, clipboard-read, pointer lock or fullscreen API today. Add a name
 * here (with a Decisions-log entry) only when a feature needs it.
 */
export const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set<string>([])

export const isPermissionAllowed = (permission: string): boolean =>
  ALLOWED_PERMISSIONS.has(permission)

/**
 * Electron grants every permission request when no handler is installed. This denies everything
 * outside `ALLOWED_PERMISSIONS`, for requests (prompts) and synchronous checks alike, and logs
 * each denial so an unexpected request is visible in the local log.
 */
export const installPermissionPolicy = (session: Session): void => {
  session.setPermissionRequestHandler((_contents, permission, callback) => {
    const allowed = isPermissionAllowed(permission)
    if (!allowed) logger.warn('[security] denied permission request', { name: permission })
    callback(allowed)
  })
  session.setPermissionCheckHandler((_contents, permission) => {
    const allowed = isPermissionAllowed(permission)
    if (!allowed) logger.warn('[security] denied permission check', { name: permission })
    return allowed
  })
}
