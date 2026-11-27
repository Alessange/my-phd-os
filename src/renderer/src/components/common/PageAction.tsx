import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PageActionContext } from './pageActionContext'

/** Mounted once by `AppShell`; the top strip renders the slot, pages fill it with `PageAction`. */
export function PageActionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [count, setCount] = useState(0)
  const register = useCallback(() => {
    setCount((value) => value + 1)
    return () => setCount((value) => value - 1)
  }, [])
  const value = useMemo(
    () => ({ slot, setSlot, count, register }),
    [slot, setSlot, count, register]
  )
  return <PageActionContext.Provider value={value}>{children}</PageActionContext.Provider>
}

/**
 * A page's primary action (its create button). The shell shows exactly one primary, top right in the
 * 48 px strip, so a page renders it through this component: inside the shell it portals into the
 * strip; without a shell (unit tests of a page) it renders inline, so tests that click the page-level
 * button keep working.
 *
 *   <PageAction><Button size="sm" onClick={openCreate}>Add event</Button></PageAction>
 */
export function PageAction({ children }: { children: ReactNode }): React.JSX.Element {
  const host = useContext(PageActionContext)
  const register = host?.register
  useEffect(() => register?.(), [register])
  if (host?.slot) return <>{createPortal(children, host.slot)}</>
  return <>{children}</>
}
