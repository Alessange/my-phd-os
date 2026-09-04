import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { createWindowApiMock, type WindowApiMock } from './windowApiMock'

/** Shared mock installed as `window.api` before every renderer test; import it to register responses. */
export const windowApi: WindowApiMock = createWindowApiMock()

Object.defineProperty(window, 'api', { value: windowApi, configurable: true, writable: true })

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    })
  })
}

beforeEach(() => {
  windowApi.reset()
})

afterEach(() => {
  windowApi.reset()
})
