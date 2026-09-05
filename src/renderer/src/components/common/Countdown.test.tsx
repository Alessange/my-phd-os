import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
