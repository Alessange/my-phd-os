export interface PlatformInfo {
  isMac: boolean
  isWindows: boolean
  isLinux: boolean
  /** Human label for the primary modifier: `⌘` or `Ctrl`. */
  modLabel: string
}

const detect = (): PlatformInfo => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform
  const isMac = /Mac|iPhone|iPad/i.test(platform) || /Macintosh/i.test(ua)
  const isWindows = /Win/i.test(platform) || /Windows/i.test(ua)
  return { isMac, isWindows, isLinux: !isMac && !isWindows, modLabel: isMac ? '⌘' : 'Ctrl' }
}

let cached: PlatformInfo | undefined

/** Platform facts derived from the user agent (stable for the life of the window). */
export const getPlatform = (): PlatformInfo => (cached ??= detect())

export const usePlatform = (): PlatformInfo => getPlatform()
