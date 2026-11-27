import { createContext, useContext } from 'react'

export interface PageActionContextValue {
  /** The element in the shell's top strip that hosts the page's primary action. */
  slot: HTMLElement | null
  setSlot: (element: HTMLElement | null) => void
  /** Number of mounted `PageAction`s; the strip's default create button hides while it is above 0. */
  count: number
  register: () => () => void
}

export const PageActionContext = createContext<PageActionContextValue | null>(null)

/** For the top strip: attach `setSlot` to the host element and hide the default create button while `count > 0`. */
export const usePageActionHost = (): PageActionContextValue | null => useContext(PageActionContext)
