import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AppShell } from './app/layout/AppShell'
import { DatabaseErrorScreen } from './app/layout/DatabaseErrorScreen'
import { ThemeProvider } from './app/layout/ThemeProvider'
import { useResolvedTheme } from './app/layout/themeContext'
import { useNavigation } from './app/navigation'
import { queryClient } from './app/queryClient'
import { useGlobalShortcuts } from './app/shortcuts'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ErrorState } from './components/common/ErrorState'
import { LoadingState } from './components/common/LoadingState'
import { TooltipProvider } from './components/ui/tooltip'
import { useDataChanged } from './hooks/useDataChanged'
import { api } from './lib/api'
import { queryKeys } from './lib/queryKeys'
import CalendarPage from './pages/CalendarPage'
import DeadlinesPage from './pages/DeadlinesPage'
import HabitsPage from './pages/HabitsPage'
import SettingsPage from './pages/SettingsPage'
import TimelinePage from './pages/TimelinePage'
import type { AppInfoWithDbError } from './types/app'

const PAGE_COMPONENTS = {
  calendar: CalendarPage,
  deadlines: DeadlinesPage,
  timeline: TimelinePage,
  habits: HabitsPage,
  settings: SettingsPage
} as const

function CurrentPage(): React.JSX.Element {
  const page = useNavigation((state) => state.page)
  const Page = PAGE_COMPONENTS[page]
  return (
    <ErrorBoundary key={page}>
      <Page />
    </ErrorBoundary>
  )
}

function Shell(): React.JSX.Element {
  useDataChanged()
  useGlobalShortcuts()
  return (
    <AppShell>
      <CurrentPage />
    </AppShell>
  )
}

/** Blocks the UI until main confirms the database is usable; shows the database screen otherwise. */
function AppGate(): React.JSX.Element {
  const info = useQuery({
    queryKey: queryKeys.app.info(),
    queryFn: async () => (await api('app:getInfo')) as AppInfoWithDbError
  })
  if (info.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Starting My PhD OS…" />
      </div>
    )
  }
  if (info.error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState
          error={info.error}
          title="Could not reach the application core"
          message="The window could not talk to the main process. Your data has not been touched."
          onRetry={() => void info.refetch()}
        />
      </div>
    )
  }
  if (info.data.dbError)
    return <DatabaseErrorScreen info={info.data} onRetry={() => void info.refetch()} />
  return <Shell />
}

function ThemedToaster(): React.JSX.Element {
  const theme = useResolvedTheme()
  return <Toaster theme={theme} richColors closeButton position="bottom-right" offset={16} />
}

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AppGate />
            <ThemedToaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
