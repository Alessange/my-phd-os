import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../src/shared/errors'

const openExternal = vi.fn(async () => undefined)
vi.mock('electron', () => ({
  shell: { openExternal },
  app: { on: vi.fn() }
}))
const warn = vi.fn()
vi.mock('../../../src/main/logging/logger', () => ({
  logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logAppError: vi.fn()
}))

const { validateExternalUrl, openExternalUrl } =
  await import('../../../src/main/security/openExternal')
const { isAllowedNavigation } = await import('../../../src/main/security/navigation')
const { DEVELOPMENT_CSP, PRODUCTION_CSP, PRODUCTION_META_CSP, cspFor } =
  await import('../../../src/main/security/csp')
const { installPermissionPolicy, isPermissionAllowed } =
  await import('../../../src/main/security/permissions')

const expectInvalid = (input: string): void => {
  try {
    validateExternalUrl(input)
    throw new Error(`expected ${input} to be rejected`)
  } catch (error) {
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe('INVALID_URL')
  }
}

describe('validateExternalUrl', () => {
  it('accepts http and https URLs', () => {
    expect(validateExternalUrl('https://ccfddl.com/conference/deadlines_en.ics').href).toBe(
      'https://ccfddl.com/conference/deadlines_en.ics'
    )
    expect(validateExternalUrl('http://example.org/path?q=1').protocol).toBe('http:')
    expect(validateExternalUrl('  https://example.org  ').host).toBe('example.org')
  })

  it('rejects other schemes', () => {
    expectInvalid('javascript:alert(1)')
    expectInvalid('file:///etc/passwd')
    expectInvalid('ftp://example.org/file')
    expectInvalid('mailto:someone@example.org')
    expectInvalid('data:text/html,hi')
  })

  it('rejects credentials, empty and malformed input', () => {
    expectInvalid('https://user:pw@example.org/')
    expectInvalid('https://user@example.org/')
    expectInvalid('')
    expectInvalid('   ')
    expectInvalid('not a url')
    expectInvalid(`https://example.org/${'a'.repeat(3000)}`)
  })

  it('openExternalUrl only reaches shell.openExternal with a validated URL', async () => {
    await openExternalUrl('https://example.org/x')
    expect(openExternal).toHaveBeenCalledWith('https://example.org/x')
    openExternal.mockClear()
    await expect(openExternalUrl('javascript:void 0')).rejects.toMatchObject({
      code: 'INVALID_URL'
    })
    expect(openExternal).not.toHaveBeenCalled()
  })
})

describe('isAllowedNavigation', () => {
  const policy = { devServerUrl: 'http://localhost:5173', rendererRoot: '/app/out/renderer' }

  it('allows the dev server origin and bundled file pages only', () => {
    expect(isAllowedNavigation('http://localhost:5173/index.html?x=1', policy)).toBe(true)
    expect(isAllowedNavigation('file:///app/out/renderer/index.html?dbError=1', policy)).toBe(true)
    expect(isAllowedNavigation('file:///app/out/main/index.js', policy)).toBe(false)
    expect(isAllowedNavigation('file:///app/out/renderer-evil/index.html', policy)).toBe(false)
    expect(isAllowedNavigation('http://localhost:5174/', policy)).toBe(false)
    expect(isAllowedNavigation('https://example.org/', policy)).toBe(false)
    expect(isAllowedNavigation('javascript:alert(1)', policy)).toBe(false)
  })

  it('ignores the dev origin when no dev server is configured', () => {
    expect(
      isAllowedNavigation('http://localhost:5173/', { rendererRoot: '/app/out/renderer' })
    ).toBe(false)
  })
})

describe('content security policy', () => {
  it('matches the architecture policy in production and relaxes only HMR needs in dev', () => {
    expect(PRODUCTION_CSP).toContain("default-src 'self'")
    expect(PRODUCTION_CSP).toContain("script-src 'self';")
    expect(PRODUCTION_CSP).toContain("connect-src 'self'")
    for (const directive of [
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
      "frame-ancestors 'none'"
    ]) {
      expect(PRODUCTION_CSP).toContain(directive)
    }
    expect(PRODUCTION_CSP).not.toContain('unsafe-eval')
    expect(DEVELOPMENT_CSP).toContain("script-src 'self' 'unsafe-inline'")
    expect(DEVELOPMENT_CSP).toContain('ws://localhost:*')
    expect(cspFor(false)).toBe(PRODUCTION_CSP)
    expect(cspFor(true)).toBe(DEVELOPMENT_CSP)
  })

  it('is mirrored byte-for-byte (minus frame-ancestors) by the <meta> tag in index.html', () => {
    const html = readFileSync(resolve('src/renderer/index.html'), 'utf8')
    const match = html.match(
      /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/>/
    )
    expect(match, 'index.html must carry exactly one CSP meta tag').not.toBeNull()
    expect(match![1]).toBe(PRODUCTION_META_CSP)
    expect(PRODUCTION_META_CSP).not.toContain('frame-ancestors')
    expect(PRODUCTION_CSP.startsWith(PRODUCTION_META_CSP)).toBe(true)
  })
})

describe('permission policy', () => {
  it('denies every permission request and check, and logs the denial', () => {
    let requestHandler:
      ((wc: unknown, permission: string, cb: (ok: boolean) => void) => void) | null = null
    let checkHandler: ((wc: unknown, permission: string) => boolean) | null = null
    const session = {
      setPermissionRequestHandler: (handler: typeof requestHandler) => {
        requestHandler = handler
      },
      setPermissionCheckHandler: (handler: typeof checkHandler) => {
        checkHandler = handler
      }
    }
    installPermissionPolicy(session as unknown as import('electron').Session)
    expect(requestHandler).not.toBeNull()
    expect(checkHandler).not.toBeNull()

    const granted: boolean[] = []
    for (const permission of ['media', 'geolocation', 'notifications', 'clipboard-read']) {
      requestHandler!(null, permission, (ok) => granted.push(ok))
      expect(checkHandler!(null, permission)).toBe(false)
      expect(isPermissionAllowed(permission)).toBe(false)
    }
    expect(granted).toEqual([false, false, false, false])
    expect(warn).toHaveBeenCalledWith('[security] denied permission request', { name: 'media' })
  })
})
