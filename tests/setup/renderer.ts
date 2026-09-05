import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import type { AppInfo } from '../../src/shared/types/app'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE } from '../../src/shared/types/settings'
import { createWindowApiMock, type WindowApiMock } from './windowApiMock'

/** Shared mock installed as `window.api` before every renderer test; import it to register responses. */
export const windowApi: WindowApiMock = createWindowApiMock()

Object.defineProperty(window, 'api', { value: windowApi, configurable: true, writable: true })

export const TEST_APP_INFO: AppInfo = {
  version: '0.0.0-test',
  platform: 'darwin',
  arch: 'arm64',
  electron: '44.2.0',
  node: '24.20.0',
  chrome: '152.0.0.0',
  userDataPath: '/tmp/my-phd-os-test',
  databasePath: '/tmp/my-phd-os-test/my-phd-os.sqlite',
  logPath: '/tmp/my-phd-os-test/logs/main.log',
  systemTimezone: 'UTC',
  isPackaged: false
}

/** Default responses most renderer tests rely on; re-registered after every `reset()`. */
export const registerDefaultResponses = (): void => {
  windowApi.respond('settings:get', {
    settings: { ...DEFAULT_SETTINGS },
    ui: { ...DEFAULT_UI_STATE }
  })
  windowApi.respond('app:getInfo', TEST_APP_INFO)
  windowApi.respond('app:log', { ok: true })
  windowApi.respond('conferences:listSubscriptions', [])
  windowApi.respond('conferences:getRefreshStatus', { inProgress: false, perSubscription: {} })
  windowApi.respond('conferences:listFollowed', [])
  windowApi.respond('conferences:listDeadlines', [])
  windowApi.respond('conferences:listChanges', [])
  windowApi.respond('settings:update', (payload) => ({
    ...DEFAULT_SETTINGS,
    ...(payload as Partial<typeof DEFAULT_SETTINGS>)
  }))
  windowApi.respond('settings:updateUi', (payload) => ({
    ...DEFAULT_UI_STATE,
    ...(payload as Partial<typeof DEFAULT_UI_STATE>)
  }))
}

// ---------------------------------------------------------------------------
// matchMedia: configurable per query so ThemeProvider / useMediaQuery can be tested.

type MediaListener = (event: MediaQueryListEvent) => void

const mediaMatches = new Map<string, boolean>()
const mediaListeners = new Map<string, Set<MediaListener>>()

/** Sets whether a media query matches and notifies listeners registered through `matchMedia`. */
export const setMediaQuery = (query: string, matches: boolean): void => {
  mediaMatches.set(query, matches)
  const event = { matches, media: query } as MediaQueryListEvent
  mediaListeners.get(query)?.forEach((listener) => listener(event))
}

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string): MediaQueryList => {
    const listeners = mediaListeners.get(query) ?? new Set<MediaListener>()
    mediaListeners.set(query, listeners)
    return {
      get matches() {
        return mediaMatches.get(query) ?? false
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener as MediaListener)
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener as MediaListener)
      },
      addListener: (listener: MediaListener | null) => {
        if (listener) listeners.add(listener)
      },
      removeListener: (listener: MediaListener | null) => {
        if (listener) listeners.delete(listener)
      },
      dispatchEvent: () => false
    } as MediaQueryList
  }
})

// jsdom lacks a few browser APIs Radix / cmdk touch.
if (!('ResizeObserver' in window)) {
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class {
      observe(): void {
        // jsdom stub
      }
      unobserve(): void {
        // jsdom stub
      }
      disconnect(): void {
        // jsdom stub
      }
    }
  })
}
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.setPointerCapture ??= () => {}

beforeEach(() => {
  windowApi.reset()
  registerDefaultResponses()
  mediaMatches.clear()
  mediaListeners.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  windowApi.reset()
})
