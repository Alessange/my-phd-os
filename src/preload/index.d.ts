import type { WindowApi } from '../shared/ipc/contract'

declare global {
  interface Window {
    /** The only bridge to the main process; see ARCHITECTURE §2 and §6. */
    api: WindowApi
  }
}

export {}
