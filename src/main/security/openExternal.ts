import { shell } from 'electron'
import { AppError } from '@shared/errors'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const MAX_URL_LENGTH = 2048

/**
 * Accepts only absolute `http(s)` URLs without embedded credentials.
 * Throws `AppError('INVALID_URL')` for anything else (`javascript:`, `file:`, `ftp:`, …).
 */
export const validateExternalUrl = (input: string): URL => {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new AppError('INVALID_URL', 'The link is empty')
  }
  if (input.length > MAX_URL_LENGTH) {
    throw new AppError('INVALID_URL', 'The link is too long', { count: input.length })
  }
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new AppError('INVALID_URL', 'The link is not a valid URL')
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new AppError('INVALID_URL', `Only http(s) links can be opened (got ${url.protocol})`, {
      code: url.protocol
    })
  }
  if (url.username || url.password) {
    throw new AppError('INVALID_URL', 'Links with embedded credentials are not allowed')
  }
  if (!url.hostname) throw new AppError('INVALID_URL', 'The link has no host')
  return url
}

/** Opens a validated `http(s)` URL in the default browser. */
export const openExternalUrl = async (input: string): Promise<void> => {
  const url = validateExternalUrl(input)
  await shell.openExternal(url.href)
}
