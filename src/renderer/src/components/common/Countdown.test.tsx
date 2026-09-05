import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Countdown } from './Countdown'

const NOW = '2026-09-04T12:00:00.000Z'

describe('Countdown', () => {
  it('formats a future deadline as days / hours / minutes', () => {
    render(<Countdown targetIso="2026-10-06T20:13:00.000Z" nowIso={NOW} />)
    const el = screen.getByText('32 days 08 hours 13 minutes')
    expect(el).toHaveAttribute('data-countdown', 'future')
  })

  it('emphasises hours and minutes with seconds under 24 hours', () => {
    render(<Countdown targetIso="2026-09-04T17:00:00.000Z" nowIso={NOW} />)
    const el = screen.getByText('05 hours 00 minutes 00 seconds')
    expect(el).toHaveAttribute('data-countdown', 'urgent')
  })

  it('shows "Passed N days ago" for a past deadline', () => {
    render(<Countdown targetIso="2026-09-02T11:00:00.000Z" nowIso={NOW} />)
    expect(screen.getByText('Passed 2 days ago')).toHaveAttribute('data-countdown', 'past')
  })

  it('renders TBD when there is no target and never invents a date', () => {
    render(<Countdown nowIso={NOW} />)
    expect(screen.getByText('TBD')).toHaveAttribute('data-countdown', 'tbd')
  })

  it('renders stacked segments with unit labels', () => {
    render(<Countdown targetIso="2026-10-06T20:13:00.000Z" nowIso={NOW} variant="stacked" />)
    const group = screen.getByRole('group', { name: '32 days 08 hours 13 minutes remaining' })
    expect(group).toHaveTextContent('32days08hours13minutes')
  })

  it('ticks every second from the shared ticker when < 24 h remain and no nowIso is given', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T12:00:00.000Z'))
    render(<Countdown targetIso="2026-09-04T17:00:00.000Z" />)
    expect(screen.getByText('05 hours 00 minutes 00 seconds')).toHaveAttribute(
      'data-countdown',
      'urgent'
    )
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('04 hours 59 minutes 59 seconds')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('04 hours 59 minutes 57 seconds')).toBeInTheDocument()
  })

  it('stays at minute precision when more than 24 h remain', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T12:00:10.000Z'))
    render(<Countdown targetIso="2026-10-06T20:13:00.000Z" />)
    expect(screen.getByText('32 days 08 hours 12 minutes')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('32 days 08 hours 12 minutes')).toBeInTheDocument()
    // The minute slice carries the boundary instant: 12:01:00 still reads 08:12, 12:02:00 reads 08:11.
    act(() => {
      vi.advanceTimersByTime(105_000)
    })
    expect(screen.getByText('32 days 08 hours 11 minutes')).toBeInTheDocument()
  })
})
