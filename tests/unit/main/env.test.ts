import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `src/main/env.ts` is evaluated once at import, so each case resets modules, stubs the
 * environment and `app.isPackaged`, and imports it afresh.
 */
const load = async (options: {
  packaged: boolean
  env: Record<string, string | undefined>
}): Promise<typeof import('../../../src/main/env')> => {
  vi.resetModules()
  for (const key of ['NODE_ENV', 'ELECTRON_RENDERER_URL', 'MY_PHD_OS_USER_DATA', 'MY_PHD_OS_E2E']) {
    vi.stubEnv(key, options.env[key] ?? '')
    if (options.env[key] === undefined) delete process.env[key]
  }
  vi.doMock('electron', () => ({ app: { isPackaged: options.packaged } }))
  return import('../../../src/main/env')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock('electron')
})

describe('isLocalDevServerUrl', () => {
  it('accepts only http://localhost-style origins', async () => {
    const { isLocalDevServerUrl } = await load({ packaged: false, env: {} })
    expect(isLocalDevServerUrl('http://localhost:5173/')).toBe(true)
    expect(isLocalDevServerUrl('http://127.0.0.1:5173')).toBe(true)
    expect(isLocalDevServerUrl('http://[::1]:5173/')).toBe(true)
    expect(isLocalDevServerUrl('https://localhost:5173/')).toBe(false)
    expect(isLocalDevServerUrl('http://attacker.example/')).toBe(false)
    expect(isLocalDevServerUrl('http://localhost.attacker.example/')).toBe(false)
    expect(isLocalDevServerUrl('file:///tmp/index.html')).toBe(false)
    expect(isLocalDevServerUrl('not a url')).toBe(false)
  })
})

describe('development switches', () => {
  it('honours NODE_ENV / ELECTRON_RENDERER_URL / MY_PHD_OS_USER_DATA in an unpackaged build', async () => {
    const env = await load({
      packaged: false,
      env: {
        NODE_ENV: 'development',
        ELECTRON_RENDERER_URL: 'http://localhost:5173',
        MY_PHD_OS_USER_DATA: '/tmp/x',
        MY_PHD_OS_E2E: '1'
      }
    })
    expect(env.isDev).toBe(true)
    expect(env.rendererDevUrl).toBe('http://localhost:5173')
    expect(env.userDataOverride).toBe('/tmp/x')
    expect(env.isE2E).toBe(true)
    expect(env.ignoredRendererUrlReason).toBeUndefined()
  })

  it('ignores every development switch in a packaged build', async () => {
    const env = await load({
      packaged: true,
      env: {
        NODE_ENV: 'development',
        ELECTRON_RENDERER_URL: 'http://localhost:5173',
        MY_PHD_OS_USER_DATA: '/tmp/x'
      }
    })
    expect(env.isDev).toBe(false)
    expect(env.rendererDevUrl).toBeUndefined()
    expect(env.userDataOverride).toBeUndefined()
    expect(env.ignoredRendererUrlReason).toBe('packaged')
  })

  it('never loads a non-local renderer URL even when unpackaged', async () => {
    const env = await load({
      packaged: false,
      env: { ELECTRON_RENDERER_URL: 'https://attacker.example/' }
    })
    expect(env.isDev).toBe(true)
    expect(env.rendererDevUrl).toBeUndefined()
    expect(env.ignoredRendererUrlReason).toBe('not-local')
  })

  it('is production when nothing is set', async () => {
    const env = await load({ packaged: false, env: {} })
    expect(env.isDev).toBe(false)
    expect(env.rendererDevUrl).toBeUndefined()
    expect(env.userDataOverride).toBeUndefined()
    expect(env.isE2E).toBe(false)
  })
})
