import { describe, expect, it } from 'vitest'
import { AppError, fromIpcError, isAppError, isIpcError, toIpcError } from './errors'
import { APP_ERROR_CODES } from './types/common'

describe('AppError', () => {
  it('carries a closed code union, message and details', () => {
    const error = new AppError('NOT_FOUND', 'Event e1 not found', { id: 'e1' })
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AppError')
    expect(error.code).toBe('NOT_FOUND')
    expect(error.details).toEqual({ id: 'e1' })
    expect(isAppError(error)).toBe(true)
    expect(APP_ERROR_CODES).toContain('UNTRUSTED_HOST')
    expect(APP_ERROR_CODES).toHaveLength(16)
  })
})

describe('toIpcError', () => {
  it('serialises AppError, plain Error and unknown values', () => {
    expect(toIpcError(new AppError('TIMEOUT', 'Slow', { ms: 20000 }))).toEqual({
      code: 'TIMEOUT',
      message: 'Slow',
      details: { ms: 20000 }
    })
    expect(toIpcError(new TypeError('boom'))).toEqual({ code: 'INTERNAL', message: 'boom' })
    expect(toIpcError('oops')).toEqual({ code: 'INTERNAL', message: 'oops' })
    expect(toIpcError(undefined)).toEqual({ code: 'INTERNAL', message: 'Unknown error' })
    expect(toIpcError({ code: 'CANCELED', message: 'User canceled' })).toEqual({
      code: 'CANCELED',
      message: 'User canceled',
      details: undefined
    })
  })
})

describe('fromIpcError', () => {
  it('rebuilds an AppError from an envelope', () => {
    const rebuilt = fromIpcError({
      code: 'INVALID_ICS',
      message: 'No VCALENDAR',
      details: { file: 'a.ics' }
    })
    expect(rebuilt).toBeInstanceOf(AppError)
    expect(rebuilt.code).toBe('INVALID_ICS')
    expect(rebuilt.details).toEqual({ file: 'a.ics' })
  })

  it('extracts a JSON envelope embedded in an Electron invoke rejection', () => {
    const wrapped = new Error(
      `Error invoking remote method 'calendar:getEvent': ${JSON.stringify({ code: 'NOT_FOUND', message: 'missing' })}`
    )
    const rebuilt = fromIpcError(wrapped)
    expect(rebuilt.code).toBe('NOT_FOUND')
    expect(rebuilt.message).toBe('missing')
  })

  it('falls back to INTERNAL for anything else', () => {
    expect(fromIpcError(new Error('plain')).code).toBe('INTERNAL')
    expect(fromIpcError(null).code).toBe('INTERNAL')
    expect(fromIpcError({ code: 'NOPE', message: 'x' }).code).toBe('INTERNAL')
  })

  it('round-trips', () => {
    const original = new AppError('UNSUPPORTED_BACKUP_VERSION', 'v9', { version: 9 })
    const rebuilt = fromIpcError(JSON.parse(JSON.stringify(toIpcError(original))))
    expect(rebuilt.code).toBe(original.code)
    expect(rebuilt.message).toBe(original.message)
    expect(rebuilt.details).toEqual(original.details)
  })

  it('isIpcError only accepts known codes', () => {
    expect(isIpcError({ code: 'IO', message: 'disk' })).toBe(true)
    expect(isIpcError({ code: 'EACCES', message: 'disk' })).toBe(false)
    expect(isIpcError('IO')).toBe(false)
  })
})
