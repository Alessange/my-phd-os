import { useEffect, type ReactNode } from 'react'
import { useNavigation } from '@renderer/app/navigation'
import { useShell } from '@renderer/app/shell'
import { PageActionProvider } from '@renderer/components/common/PageAction'
import { useSettings } from '@renderer/hooks/useSettings'
import { toastError } from '@renderer/lib/toast'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * Sidebar | [top strip / page], all on one paper ground (DESIGN.md section 7). Hydrates navigation
 * and sidebar state from persisted UI settings once, then persists changes back through the stores.
 * When settings could not be loaded the shell runs on defaults and says so with a Retry toast
 * (ARCHITECTURE section 0.7: nothing fails silently).
 */
export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const { ui, settings, isLoaded, error, refetch } = useSettings()
  const { lastPage, sidebarCollapsed } = ui
  const { launchPage } = settings

  useEffect(() => {
    if (!isLoaded) return
    useShell.getState().hydrate({ sidebarCollapsed })
    useNavigation.getState().hydrate(lastPage, launchPage)
  }, [isLoaded, sidebarCollapsed, lastPage, launchPage])

  useEffect(() => {
    if (error === null || error === undefined) return
    toastError(error, {
      title: 'Could not load your settings',
      retry: refetch
    })
  }, [error, refetch])

  return (
    <PageActionProvider>
      <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
            {children}
          </main>
        </div>
        <CommandPalette />
      </div>
    </PageActionProvider>
  )
}
