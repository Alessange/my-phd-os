import { useEffect, type ReactNode } from 'react'
import { useNavigation } from '@renderer/app/navigation'
import { useShell } from '@renderer/app/shell'
import { useSettings } from '@renderer/hooks/useSettings'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * Sidebar | [TopBar / page]. Hydrates navigation + sidebar state from persisted UI settings once,
 * then persists changes back through the stores.
 */
export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const { ui, settings, isLoaded } = useSettings()
  const { lastPage, sidebarCollapsed } = ui
  const { launchPage } = settings

  useEffect(() => {
    if (!isLoaded) return
    useShell.getState().hydrate({ sidebarCollapsed })
    useNavigation.getState().hydrate(lastPage, launchPage)
  }, [isLoaded, sidebarCollapsed, lastPage, launchPage])

  return (
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
  )
}
