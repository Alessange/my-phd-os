import { Database, FolderOpen, Loader2 } from 'lucide-react'
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
    <div className="flex h-full min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div
        role="alert"
        className="flex w-full max-w-lg flex-col gap-4 rounded-lg border bg-card p-6 shadow-md"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/12 text-destructive">
            <Database className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-base font-semibold">The database could not be opened</h1>
            <p className="text-[13px] text-muted-foreground">
              My PhD OS kept your data file untouched. Nothing was deleted or rewritten. The details
              below and the log file should explain what went wrong.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md bg-muted/60 p-3 text-xs">
          <dt className="font-medium text-muted-foreground">Error</dt>
          <dd className="break-words">
            {info.dbError?.message}
            {info.dbError?.code && (
              <span className="ml-1 text-muted-foreground">({info.dbError.code})</span>
            )}
          </dd>
          <dt className="font-medium text-muted-foreground">Database</dt>
          <dd className="break-all font-mono">{info.databasePath}</dd>
          <dt className="font-medium text-muted-foreground">Log file</dt>
          <dd className="break-all font-mono">{info.logPath}</dd>
          <dt className="font-medium text-muted-foreground">Version</dt>
          <dd>
            {info.version} · {info.platform} {info.arch}
          </dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          If the file is locked by another copy of the app, close it and retry. If the database was
          created by a newer version, install that version again — downgrading never migrates data.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={openDirectory}>
            <FolderOpen aria-hidden="true" />
            Open data directory
          </Button>
          <Button onClick={onRetry} disabled={retrying}>
            {retrying && <Loader2 aria-hidden="true" className="animate-spin" />}
            {retrying ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      </div>
    </div>
  )
}
