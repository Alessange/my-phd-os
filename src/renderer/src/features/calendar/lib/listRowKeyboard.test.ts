import type { EventMountArg } from '@fullcalendar/core'
import { describe, expect, it, vi } from 'vitest'
import { makeListRowKeyboardActivatable } from './listRowKeyboard'

const mount = (viewType: string): { row: HTMLTableRowElement; onClick: () => void } => {
  const row = document.createElement('tr')
  const onClick = vi.fn()
  row.addEventListener('click', onClick)
  makeListRowKeyboardActivatable({ el: row, view: { type: viewType } } as unknown as EventMountArg)
  return { row, onClick }
}

const press = (row: HTMLElement, key: string): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  row.dispatchEvent(e)
  return e
}

describe('makeListRowKeyboardActivatable', () => {
  it('puts agenda rows in the tab order and presses them with Enter or Space', () => {
    const { row, onClick } = mount('listWeek')
    expect(row.tabIndex).toBe(0)
    expect(press(row, 'Enter').defaultPrevented).toBe(true)
    press(row, ' ')
    expect(onClick).toHaveBeenCalledTimes(2)
    press(row, 'a')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('leaves the grid views alone (their events are already anchors)', () => {
    const { row } = mount('timeGridWeek')
    expect(row.hasAttribute('tabindex')).toBe(false)
  })
})
