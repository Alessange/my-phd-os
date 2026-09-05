/** Process-level switches read once at startup (see ARCHITECTURE §5, §11). */
export const isDev = process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_RENDERER_URL

/** `MY_PHD_OS_E2E=1`: no startup subscription refresh, no background network. */
export const isE2E = process.env.MY_PHD_OS_E2E === '1'

/** `MY_PHD_OS_USER_DATA`: overrides `app.getPath('userData')` before `whenReady` (tests). */
export const userDataOverride = process.env.MY_PHD_OS_USER_DATA?.trim() || undefined

export const rendererDevUrl = process.env.ELECTRON_RENDERER_URL?.trim() || undefined
