import { app } from 'electron'

/**
 * Process-level switches read once at startup (see ARCHITECTURE §5, §11). Every development
 * switch is gated on `!app.isPackaged`: an installed build never honours `NODE_ENV`,
 * `ELECTRON_RENDERER_URL` or `MY_PHD_OS_USER_DATA` from the environment, so a foreign page can
 * never be loaded into the trusted window and DevTools / the relaxed CSP stay off.
 */
const isPackaged = app.isPackaged

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** True for `http://localhost:<port>/…` style URLs only — the only renderer origins dev may load. */
export const isLocalDevServerUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

const rawRendererUrl = process.env.ELECTRON_RENDERER_URL?.trim() || undefined

export const isDev =
  !isPackaged && (process.env.NODE_ENV === 'development' || rawRendererUrl !== undefined)

/** `MY_PHD_OS_E2E=1`: no startup subscription refresh, no background network. */
export const isE2E = process.env.MY_PHD_OS_E2E === '1'

/** `MY_PHD_OS_USER_DATA`: overrides `app.getPath('userData')` before `whenReady` (tests, unpackaged only). */
export const userDataOverride = isPackaged
  ? undefined
  : process.env.MY_PHD_OS_USER_DATA?.trim() || undefined

/** Vite dev-server URL; only in dev and only when it points at localhost. */
export const rendererDevUrl =
  isDev && rawRendererUrl && isLocalDevServerUrl(rawRendererUrl) ? rawRendererUrl : undefined

/** Set when `ELECTRON_RENDERER_URL` was present but ignored (packaged build or non-local host). */
export const ignoredRendererUrlReason: 'packaged' | 'not-local' | undefined =
  rawRendererUrl === undefined
    ? undefined
    : isPackaged
      ? 'packaged'
      : rendererDevUrl === undefined
        ? 'not-local'
        : undefined
