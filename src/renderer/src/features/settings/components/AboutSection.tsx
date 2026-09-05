import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { CCF_DEADLINES_HOMEPAGE, CCF_DEADLINES_REPOSITORY } from '@shared/constants/hosts'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'
import { OPEN_SOURCE_LICENSES } from '../licenses'

const openExternal = (url: string): void => {
  api('app:openExternal', { url }).catch((error: unknown) =>
    toastError(error, { title: 'Could not open the link', retry: () => openExternal(url) })
  )
}

function ExternalButton({ url, children }: { url: string; children: string }): React.JSX.Element {
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto px-0"
      onClick={() => openExternal(url)}
      aria-label={`${children} (opens in your browser)`}
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-3" />
    </Button>
  )
}

export function AboutSection(): React.JSX.Element {
  const info = useQuery({ queryKey: queryKeys.app.info(), queryFn: () => api('app:getInfo') })

  return (
    <div className="flex flex-col gap-6 text-[13px]">
      <div>
        <h3 className="mb-1.5 text-sm font-semibold">Version</h3>
        {info.isPending ? (
          <LoadingState variant="inline" label="Reading version…" />
        ) : info.error ? (
          <ErrorState variant="compact" error={info.error} onRetry={() => void info.refetch()} />
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">My PhD OS</dt>
            <dd>
              {info.data.version}
              {!info.data.isPackaged && (
                <span className="ml-1 text-muted-foreground">(development build)</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Platform</dt>
            <dd>
              {info.data.platform} {info.data.arch}
            </dd>
            <dt className="text-muted-foreground">Runtime</dt>
            <dd>
              Electron {info.data.electron} · Chromium {info.data.chrome} · Node {info.data.node}
            </dd>
            <dt className="text-muted-foreground">Data directory</dt>
            <dd className="font-mono break-all">{info.data.userDataPath}</dd>
          </dl>
        )}
      </div>

      <div>
        <h3 className="mb-1.5 text-sm font-semibold">Where your data lives</h3>
        <p className="text-muted-foreground">
          Everything you enter is stored in a single SQLite database inside the application data
          directory on this computer. There is no account, no cloud copy and no telemetry. Use
          Settings › Data to export a JSON backup or the calendar as .ics, and to open the
          directory.
        </p>
      </div>

      <div>
        <h3 className="mb-1.5 text-sm font-semibold">Offline behaviour</h3>
        <p className="text-muted-foreground">
          The app works fully offline. The only network requests it ever makes fetch the public
          conference-deadline feeds you subscribe to, from the main process, carrying no personal
          data. When a refresh fails, the last successfully retrieved snapshot stays available and
          is marked as cached.
        </p>
      </div>

      <div>
        <h3 className="mb-1.5 text-sm font-semibold">Conference data</h3>
        <p className="text-muted-foreground">
          Conference deadlines come from the community-maintained <strong>CCF Deadlines</strong>{' '}
          project. Deadlines are shown exactly as published upstream; the app never edits or
          extrapolates them.
        </p>
        <div className="mt-1 flex flex-wrap gap-4">
          <ExternalButton url={CCF_DEADLINES_HOMEPAGE}>ccfddl.com</ExternalButton>
          <ExternalButton url={CCF_DEADLINES_REPOSITORY}>
            github.com/ccfddl/ccf-deadlines
          </ExternalButton>
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-sm font-semibold">Open-source licenses</h3>
        <ul className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          {OPEN_SOURCE_LICENSES.map((entry) => (
            <li
              key={entry.name}
              className="flex items-baseline justify-between gap-2 border-b border-dashed py-1"
            >
              <ExternalButton url={entry.url}>{entry.name}</ExternalButton>
              <span className="shrink-0 text-muted-foreground">{entry.license}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
