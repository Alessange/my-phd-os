import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import { logAppError, logger } from '../logging/logger'
import { openExternalUrl } from './openExternal'

export interface NavigationPolicy {
  /** Dev-server origin (e.g. `http://localhost:5173`) — allowed only in development. */
  devServerUrl?: string
  /** Directory holding the bundled renderer (`out/renderer`); `file:` URLs inside it are allowed. */
  rendererRoot: string
}

const originOf = (url: string): string | null => {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** True when `url` is the app's own renderer (dev server origin or a bundled `file:` page). */
export const isAllowedNavigation = (url: string, policy: NavigationPolicy): boolean => {
  if (policy.devServerUrl) {
    const devOrigin = originOf(policy.devServerUrl)
    if (devOrigin && originOf(url) === devOrigin) return true
  }
  if (url.startsWith('file:')) {
    const root = pathToFileURL(policy.rendererRoot).href.replace(/\/?$/, '/')
    return url.startsWith(root)
  }
  return false
}

/**
 * Locks down every WebContents the app creates: no navigation away from the renderer, no
 * `window.open` (validated http(s) links go to the default browser), no `<webview>`.
 */
export const installNavigationGuards = (policy: NavigationPolicy): void => {
  app.on('web-contents-created', (_event, contents) => {
    const block = (event: { preventDefault(): void }, url: string, kind: string): void => {
      if (isAllowedNavigation(url, policy)) return
      event.preventDefault()
      logger.warn(`[security] blocked ${kind}`, { host: originOf(url) ?? 'unknown' })
    }
    contents.on('will-navigate', (event, url) => block(event, url, 'navigation'))
    contents.on('will-redirect', (event, url) => block(event, url, 'redirect'))
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
      logger.warn('[security] blocked webview attachment')
    })
    contents.setWindowOpenHandler(({ url }) => {
      openExternalUrl(url).catch((error) => logAppError('security.windowOpen', error))
      return { action: 'deny' }
    })
  })
}
