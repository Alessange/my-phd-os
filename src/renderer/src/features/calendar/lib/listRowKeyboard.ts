import type { EventMountArg } from '@fullcalendar/core'

/**
 * FullCalendar's own list rows are plain `<tr>`s, so unlike the grid events they are not in the tab
 * order. Make each one focusable and let Enter / Space press it through the same click path
 * (`eventClick`), so every agenda event opens from the keyboard. The row keeps its table semantics.
 */
export const makeListRowKeyboardActivatable = (arg: EventMountArg): void => {
  if (!arg.view.type.startsWith('list')) return
  const row = arg.el
  row.tabIndex = 0
  row.addEventListener('keydown', (e) => {
    if (e.target !== row || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    row.click()
  })
}
