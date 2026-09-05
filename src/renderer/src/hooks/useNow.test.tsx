import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow'

describe('useNow', () => {
  it('re-renders minute subscribers once a minute even while a second clock is mounted', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T12:00:10.000Z'))
    let minuteRenders = 0
    const minute = renderHook(() => {
      minuteRenders += 1
      return useNow({ precision: 'minute' })
    })
    const second = renderHook(() => useNow({ precision: 'second' }))
    const rendersAfterMount = minuteRenders
    expect(second.result.current).toBe('2026-09-04T12:00:10.000Z')

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(second.result.current).toBe('2026-09-04T12:00:13.000Z')
    expect(minute.result.current).toBe('2026-09-04T12:00:10.000Z')
    expect(minuteRenders).toBe(rendersAfterMount)

    act(() => {
      vi.advanceTimersByTime(47_000)
    })
    expect(minute.result.current).toBe('2026-09-04T12:01:00.000Z')
    expect(second.result.current).toBe('2026-09-04T12:01:00.000Z')
    expect(minuteRenders).toBe(rendersAfterMount + 1)

    second.unmount()
    minute.unmount()
  })

  it('stops ticking when the last subscriber unmounts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T12:00:10.000Z'))
    const hook = renderHook(() => useNow({ precision: 'second' }))
    hook.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
