import { create } from 'zustand'
import type { UiState } from '@shared/types/settings'
import { persistUi } from '@renderer/hooks/useSettings'

interface ShellState {
  sidebarCollapsed: boolean
  hydrated: boolean
  hydrate: (ui: Pick<UiState, 'sidebarCollapsed'>) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
}

/** Layout state that must be reachable from commands and shortcuts, persisted through `settings:updateUi`. */
export const useShell = create<ShellState>((set, get) => ({
  sidebarCollapsed: false,
  hydrated: false,
  hydrate: (ui) => {
    if (get().hydrated) return
    set({ sidebarCollapsed: ui.sidebarCollapsed, hydrated: true })
  },
  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed })
    void persistUi({ sidebarCollapsed: collapsed })
  },
  toggleSidebar: () => get().setSidebarCollapsed(!get().sidebarCollapsed)
}))
