import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import type { AppInfo } from '@shared/types/app'
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
import { useSettings } from './hooks/useSettings'
import { api } from './lib/api'
import { queryKeys } from './lib/queryKeys'
import { toastError } from './lib/toast'
import CalendarPage from './pages/CalendarPage'
import DeadlinesPage from './pages/DeadlinesPage'
import HabitsPage from './pages/HabitsPage'
import SettingsPage from './pages/SettingsPage'
import TimelinePage from './pages/TimelinePage'

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

const Starting = (): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <LoadingState label="Starting My PhD OS…" />
  </div>
)

/**
 * Blocks the UI until main confirms the database is usable and the first `settings:get` has
 * settled, so the shell hydrates from persisted settings (never from defaults racing the fetch).
 * A settings failure falls back to defaults; `AppShell` surfaces it with a Retry toast.
 */
function AppGate(): React.JSX.Element {
  const info = useQuery({
    queryKey: queryKeys.app.info(),
    queryFn: () => api('app:getInfo')
  })
  const settings = useSettings()
  const retryDatabase = useMutation({
    mutationFn: () => api('app:retryDatabase'),
    onSuccess: (next: AppInfo) => {
      queryClient.setQueryData(queryKeys.app.info(), next)
      // Reset (not invalidate): the settings query failed while the database was down, and a
      // stale error must not surface as a toast once the shell mounts.
      if (!next.dbError) void queryClient.resetQueries({ queryKey: queryKeys.settings.all })
    },
    onError: (error: unknown) =>
      toastError(error, {
        title: 'Could not reopen the database',
        retry: () => retryDatabase.mutate()
      })
  })
  if (info.isPending) return <Starting />
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
  if (info.data.dbError) {
    return (
      <DatabaseErrorScreen
        info={info.data}
        onRetry={() => retryDatabase.mutate()}
        retrying={retryDatabase.isPending}
      />
    )
  }
  if (!settings.isLoaded && settings.error === null) return <Starting />
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
