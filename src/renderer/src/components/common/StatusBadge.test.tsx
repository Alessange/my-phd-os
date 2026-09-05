import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CONFERENCE_STATUS_DEFINITIONS,
  DEADLINE_STATUS_DEFINITIONS,
  MILESTONE_STATUS_DEFINITIONS,
  PRIORITY_DEFINITIONS
} from '@shared/constants/statuses'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it.each(Object.values(DEADLINE_STATUS_DEFINITIONS))(
    'shows the text label and an icon for deadline status "$id"',
    (definition) => {
      const { container } = render(<StatusBadge status={definition.id} />)
      expect(screen.getByText(definition.label)).toBeInTheDocument()
      expect(container.querySelector('svg')).not.toBeNull()
      expect(container.querySelector('[data-status]')).toHaveAttribute('data-status', definition.id)
    }
  )

  it.each([
    ...Object.values(CONFERENCE_STATUS_DEFINITIONS),
    ...Object.values(MILESTONE_STATUS_DEFINITIONS)
  ])('resolves conference and milestone status "$id" by id', (definition) => {
    render(<StatusBadge status={definition.id} />)
    expect(screen.getByText(definition.label)).toBeInTheDocument()
  })

  it('accepts a full definition (e.g. a priority) and can hide the icon', () => {
    const { container } = render(<StatusBadge status={PRIORITY_DEFINITIONS.critical} hideIcon />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('falls back to plain text for an unknown id instead of guessing a colour', () => {
    render(<StatusBadge status="something_new" />)
    expect(screen.getByText('something_new')).toBeInTheDocument()
  })
})
