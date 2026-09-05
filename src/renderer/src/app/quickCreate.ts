import { useEffect } from 'react'
import { create } from 'zustand'
import type { PageId } from '@shared/types/settings'
import { toastInfo } from '@renderer/lib/toast'
import { getPage, useNavigation } from './navigation'
import { dispatchCommand } from './commandBus'

type QuickCreateHandler = () => void

interface QuickCreateState {
  handlers: Partial<Record<PageId, QuickCreateHandler>>
  register: (page: PageId, handler: QuickCreateHandler) => () => void
}

export const useQuickCreateStore = create<QuickCreateState>((set, get) => ({
  handlers: {},
  register: (page, handler) => {
    set({ handlers: { ...get().handlers, [page]: handler } })
    return () => {
      const { [page]: current, ...rest } = get().handlers
      if (current === handler) set({ handlers: rest })
    }
  }
}))

/** Pages call this so `mod+N`, the menu and the top-bar button open the right creation dialog. */
export const useRegisterQuickCreate = (page: PageId, handler: QuickCreateHandler): void => {
  const register = useQuickCreateStore((state) => state.register)
  useEffect(() => register(page, handler), [register, page, handler])
}

/** Runs the current page's quick-create handler (and the `quick-create` bus command). */
export const triggerQuickCreate = (): void => {
  const page = useNavigation.getState().page
  const handler = useQuickCreateStore.getState().handlers[page]
  const listeners = dispatchCommand('quick-create', { page })
  if (handler) {
    handler()
    return
  }
  if (listeners === 0) {
    const definition = getPage(page)
    toastInfo(
      definition.createLabel
        ? `Nothing to create here yet`
        : `Nothing to create on ${definition.label}`,
      definition.createLabel
        ? `Creating a ${definition.createLabel.toLowerCase()} is not available on this screen.`
        : 'Switch to Calendar, Deadlines, Timeline or Habits to create something.'
    )
  }
}

export const quickCreateLabel = (page: PageId): string | undefined => getPage(page).createLabel
