import { useRef } from 'react'

type AutoFocusHandler = (event: Event) => void

/**
 * Overlays here are controlled (`open={x !== undefined}`), so Radix has no `Trigger` to hand focus
 * back to and, with its default prevented, leaves it on `<body>` after Esc. This remembers the
 * element that had focus when the overlay opened and returns focus to it on close (WCAG 2.4.3).
 * The caller's own handlers run too and can still `preventDefault()` to take over; an element
 * that has since left the DOM is skipped so Radix's default applies.
 */
export function useRestoreFocus(handlers: {
  onOpenAutoFocus?: AutoFocusHandler
  onCloseAutoFocus?: AutoFocusHandler
}): { onOpenAutoFocus: AutoFocusHandler; onCloseAutoFocus: AutoFocusHandler } {
  const opener = useRef<HTMLElement | null>(null)
  const { onOpenAutoFocus, onCloseAutoFocus } = handlers
  return {
    onOpenAutoFocus: (event) => {
      // Read the opener before the caller's handler runs: handlers that take over focus move it
      // into the overlay, and the overlay itself must never be remembered as the opener.
      const active = document.activeElement
      onOpenAutoFocus?.(event)
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null
    },
    onCloseAutoFocus: (event) => {
      onCloseAutoFocus?.(event)
      const target = opener.current
      opener.current = null
      if (event.defaultPrevented || !target?.isConnected) return
      event.preventDefault()
      target.focus()
    }
  }
}
