import { describe, expect, it, vi } from 'vitest'
import { windowApi } from '../../../../tests/setup/renderer'
import { logError, toLogContext } from './log'

describe('renderer log context', () => {
  it('keeps primitives, truncates long strings and never forwards whole records', () => {
    const context = toLogContext({
      command: 'go-to-habits',
      count: 3,
      ok: false,
      nothing: null,
      event: { title: 'Private meeting', description: 'secret' },
      ids: ['a', 'b'],
      long: 'y'.repeat(600)
    })
    expect(context).toMatchObject({
      command: 'go-to-habits',
      count: 3,
      ok: false,
      nothing: null,
      event: '[object]',
      ids: '[2 items]'
    })
    expect(context.long).toBe(`${'y'.repeat(500)}… [600 chars]`)
    expect(
      Object.keys(
        toLogContext(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, i])))
      )
    ).toHaveLength(20)
  })

  it('sends only the error name and a bounded message through app:log', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logError('Renderer crashed', new RangeError('x'.repeat(2_000)), { componentStack: 'at App' })
    await vi.waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('app:log', expect.anything())
    )
    const [, payload] = windowApi.invoke.mock.calls.find(([channel]) => channel === 'app:log')!
    expect(payload).toMatchObject({
      level: 'error',
      message: 'Renderer crashed',
      context: { componentStack: 'at App', errorName: 'RangeError' }
    })
    const message = (payload as { context: { errorMessage: string } }).context.errorMessage
    expect(message.length).toBeLessThan(600)
    expect(message.endsWith('[2000 chars]')).toBe(true)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
