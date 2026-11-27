import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { CCF_DEADLINES_HOMEPAGE, CCF_DEADLINES_REPOSITORY } from '@shared/constants/hosts'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { OPEN_SOURCE_LICENSES } from '../licenses'

const openExternal = (url: string): void => {
  api('app:openExternal', { url }).catch((error: unknown) =>
    toastError(error, { title: 'Could not open the link', retry: () => openExternal(url) })
  )
}

function ExternalLink({
  url,
  children,
  className
}: {
  url: string
  children: string
  className?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn('link-quiet text-left', className)}
      onClick={() => openExternal(url)}
      aria-label={`${children} (opens in your browser)`}
      title={children}
    >
      {children}
    </button>
  )
}

/** One About block: an ink title and an ink-2 paragraph, separated from the next by a hairline. */
function Block({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-4 first:pt-2">
      <h3 className="text-body text-ink">{title}</h3>
      {children}
    </div>
  )
}

export function AboutSection(): React.JSX.Element {
  const info = useQuery({ queryKey: queryKeys.app.info(), queryFn: () => api('app:getInfo') })
  const [licensesOpen, setLicensesOpen] = useState(false)
  const licensesId = useId()

  return (
    <div className="flex flex-col text-body text-ink-2">
      <Block title="Version">
        {info.isPending ? (
          <LoadingState variant="inline" label="Reading version…" />
        ) : info.error ? (
          <ErrorState variant="compact" error={info.error} onRetry={() => void info.refetch()} />
        ) : (
          <dl className="tabular grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-0.5">
            <dt className="text-ink-3">My PhD OS</dt>
            <dd>
              <span>{info.data.version}</span>
              {!info.data.isPackaged && <span className="text-ink-3"> (development build)</span>}
            </dd>
            <dt className="text-ink-3">Platform</dt>
            <dd>
              {info.data.platform} {info.data.arch}
            </dd>
            <dt className="text-ink-3">Runtime</dt>
            <dd>
              Electron {info.data.electron} · Chromium {info.data.chrome} · Node {info.data.node}
            </dd>
          </dl>
        )}
      </Block>

      <Block title="Where your data lives">
        <p>
          Everything is stored in a single SQLite database in the application data directory on this
          computer: no account, no cloud copy, no telemetry. Export a backup or open the directory
          from Settings › Data.
        </p>
      </Block>

      <Block title="Offline behaviour">
        <p>
          The app works fully offline. The only network requests it makes fetch the conference feeds
          you subscribe to, from the main process, with no personal data. When a refresh fails, the
          last good snapshot stays available and is marked as cached.
        </p>
      </Block>

      <Block title="Conference data">
        <p>
          Conference deadlines come from the community-maintained CCF Deadlines project. Deadlines
          are shown exactly as published upstream; the app never edits or extrapolates them.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1">
          <ExternalLink url={CCF_DEADLINES_HOMEPAGE}>ccfddl.com</ExternalLink>
          <ExternalLink url={CCF_DEADLINES_REPOSITORY}>
            github.com/ccfddl/ccf-deadlines
          </ExternalLink>
        </div>
      </Block>

      <div className="flex flex-col gap-3 py-4">
        <h3 className="text-body text-ink">
          <button
            type="button"
            aria-expanded={licensesOpen}
            aria-controls={licensesId}
            onClick={() => setLicensesOpen((open) => !open)}
            className="hit-28 -mx-1 inline-flex items-center gap-1.5 rounded-sm px-1 hover:bg-hover"
          >
            Open-source licenses
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-4 text-ink-3 transition-transform duration-100',
                licensesOpen && 'rotate-180'
              )}
            />
          </button>
        </h3>
        {licensesOpen && (
          <ul id={licensesId} className="grid gap-x-10 sm:grid-cols-2">
            {OPEN_SOURCE_LICENSES.map((entry) => (
              <li
                key={entry.name}
                className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line py-1.5"
              >
                <ExternalLink url={entry.url} className="min-w-0 truncate">
                  {entry.name}
                </ExternalLink>
                <span className="shrink-0 text-meta text-ink-3">{entry.license}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
