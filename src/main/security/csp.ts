import type { Session } from 'electron'

/**
 * Production policy (ARCHITECTURE §2). The packaged renderer is loaded over `file:`, where a
 * header-delivered CSP is not guaranteed to apply, so the `<meta http-equiv>` tag in
 * `src/renderer/index.html` must carry the same policy (minus `frame-ancestors`, which `<meta>`
 * cannot express). `tests/unit/main/security.test.ts` asserts the two never drift.
 */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

/** Directives a `<meta http-equiv="Content-Security-Policy">` tag ignores. */
const META_UNSUPPORTED_DIRECTIVES = ['frame-ancestors', 'report-uri', 'sandbox']

/** The production policy as it must appear in the `<meta>` tag of index.html. */
export const PRODUCTION_META_CSP = PRODUCTION_CSP.split('; ')
  .filter((directive) => !META_UNSUPPORTED_DIRECTIVES.includes(directive.split(' ')[0]))
  .join('; ')

/** Development relaxes only what Vite HMR and the React refresh preamble need. */
export const DEVELOPMENT_CSP = PRODUCTION_CSP.replace(
  "script-src 'self'",
  "script-src 'self' 'unsafe-inline'"
).replace("connect-src 'self'", "connect-src 'self' ws://localhost:* http://localhost:*")

export const cspFor = (dev: boolean): string => (dev ? DEVELOPMENT_CSP : PRODUCTION_CSP)

/** Adds the CSP header to every response the renderer session receives. */
export const installContentSecurityPolicy = (session: Session, dev: boolean): void => {
  const policy = cspFor(dev)
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] }
    })
  })
}
