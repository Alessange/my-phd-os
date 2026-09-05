import type { Session } from 'electron'

/** Production policy (ARCHITECTURE §2); mirrored by the `<meta http-equiv>` tag in index.html. */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

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
