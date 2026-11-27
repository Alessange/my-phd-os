import type { AppInfo } from '@shared/types/app'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { toastError } from '@renderer/lib/toast'

export interface DatabaseErrorScreenProps {
  info: AppInfo
  /** Asks main to re-open and migrate the database (`app:retryDatabase`). */
  onRetry: () => void
  retrying?: boolean
}

/**
 * Blocking screen shown when main reports that the database could not be opened or upgraded.
 * It explains, points to the log, and never offers to delete or recreate the database file.
 * Retry really re-opens the database in main, so releasing a lock and retrying works.
 */
export function DatabaseErrorScreen({
  info,
  onRetry,
  retrying = false
}: DatabaseErrorScreenProps): React.JSX.Element {
  const openDirectory = (): void => {
    api('app:openDataDirectory').catch((error: unknown) =>
      toastError(error, { title: 'Could not open the data directory', retry: openDirectory })
    )
  }
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <div role="alert" className="flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-title text-ink">The database could not be opened</h1>
          <p className="text-sm text-ink-2">
            My PhD OS kept your data file untouched. Nothing was deleted or rewritten. The details
            below and the log file should explain what went wrong.
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y py-4 text-sm">
          <dt className="text-ink-3">Error</dt>
          <dd className="break-words">
            {info.dbError?.message}
            {info.dbError?.code && <span className="ml-1 text-ink-3">({info.dbError.code})</span>}
          </dd>
          <dt className="text-ink-3">Database</dt>
          <dd className="tabular break-all">{info.databasePath}</dd>
          <dt className="text-ink-3">Log file</dt>
          <dd className="tabular break-all">{info.logPath}</dd>
          <dt className="text-ink-3">Version</dt>
          <dd>
            {info.version} · {info.platform} {info.arch}
          </dd>
        </dl>
        <p className="text-xs text-ink-3">
          If the file is locked by another copy of the app, close it and retry. If the database was
          created by a newer version, install that version again — downgrading never migrates data.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="ghost" onClick={openDirectory}>
            Open data directory
          </Button>
          <Button onClick={onRetry} disabled={retrying}>
            {retrying ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      </div>
    </div>
  )
}
