import { describe, expect, it, vi } from 'vitest'

vi.mock('electron-log/main', () => ({
  default: {
    transports: { file: {}, console: {} },
    errorHandler: { startCatching: vi.fn() },
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

const { sanitizeDetails, sanitizeRendererContext } =
  await import('../../../src/main/logging/logger')

describe('sanitizeDetails', () => {
  it('keeps only primitive values under allow-listed keys and collapses arrays', () => {
    expect(
      sanitizeDetails({ id: 'a', title: 'secret', ids: ['x', 'y'], nested: { id: 'b' } })
    ).toEqual({ id: 'a', ids: '[2 items]' })
    expect(sanitizeDetails('nope')).toBeUndefined()
    expect(sanitizeDetails({ title: 'secret' })).toBeUndefined()
  })
})

describe('sanitizeRendererContext', () => {
  it('truncates long strings and marks the original length', () => {
    const long = 'x'.repeat(1_200)
    const safe = sanitizeRendererContext({ componentStack: long })
    expect(safe?.componentStack).toBe(`${'x'.repeat(500)}… [1200 chars]`)
  })

  it('keeps primitives, replaces objects/arrays with markers and caps the key count', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]))
    const safe = sanitizeRendererContext({
      ...many,
      flag: true,
      nothing: null,
      record: { title: 'secret' },
      list: [1, 2, 3],
      skipped: undefined
    })
    expect(Object.keys(safe ?? {})).toHaveLength(20)
    expect(safe?.k0).toBe(0)
    expect(safe).not.toHaveProperty('record')
    expect(sanitizeRendererContext({ record: { title: 'secret' }, list: [1, 2] })).toEqual({
      record: '[object]',
      list: '[2 items]'
    })
    expect(sanitizeRendererContext(undefined)).toBeUndefined()
    expect(sanitizeRendererContext({})).toBeUndefined()
  })
})
