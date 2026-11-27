import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchCommand, dispatchCommandWhenMounted, subscribeCommand } from './commandBus'

describe('commandBus', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('drops a plain dispatch that nobody listens to', () => {
    expect(dispatchCommand('test:plain')).toBe(0)
    const listener = vi.fn()
    const off = subscribeCommand('test:plain', listener)
    expect(listener).not.toHaveBeenCalled()
    off()
  })

  it('delivers to a mounted listener at once', () => {
    const listener = vi.fn()
    const off = subscribeCommand('test:mounted', listener)
    dispatchCommandWhenMounted('test:mounted', { view: 'dayGridMonth' })
    expect(listener).toHaveBeenCalledExactlyOnceWith({ view: 'dayGridMonth' })
    off()
  })

  it('hands a command sent before the page mounted to the first subscriber, once', () => {
    dispatchCommandWhenMounted('test:early', { a: '1' })
    const first = vi.fn()
    const offFirst = subscribeCommand('test:early', first)
    expect(first).toHaveBeenCalledExactlyOnceWith({ a: '1' })
    offFirst()
    const second = vi.fn()
    const offSecond = subscribeCommand('test:early', second)
    expect(second).not.toHaveBeenCalled()
    offSecond()
  })

  it('does not replay a stale deferred command', () => {
    vi.useFakeTimers()
    dispatchCommandWhenMounted('test:stale')
    vi.advanceTimersByTime(10_000)
    const listener = vi.fn()
    const off = subscribeCommand('test:stale', listener)
    expect(listener).not.toHaveBeenCalled()
    off()
  })
})
