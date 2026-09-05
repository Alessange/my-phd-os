import { CalendarDays, Database, FileJson, FolderOpen, Trash2, Upload } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import {
  CLEAR_ALL_DATA_CONFIRMATION,
  type BackupImportMode,
  type BackupImportSummary
} from '@shared/types/data'
import { useCommandListener } from '@renderer/app/commandBus'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { useFormat } from '@renderer/hooks/useFormat'
import { toastSuccess } from '@renderer/lib/toast'
import {
  useClearAllData,
  useCommitBackupImport,
  useExportBackup,
  useExportCalendar,
  useOpenDataDirectory,
  usePreviewBackupImport,
  useStorageInfo
} from '../api'

function DataRow({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: typeof Database
  title: string
  description: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-3 not-last:border-b">
      <div className="flex min-w-0 flex-1 gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium">{title}</h3>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

const countsList = (counts: BackupImportSummary['counts']): string =>
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([entity, n]) => `${n} ${entity.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
    .join(', ') || 'no records'

const formatBytes = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * Settings › Data (spec §17): storage location and size, JSON backup export, import with a
 * mandatory preview, calendar export, and clearing all data behind a typed second confirmation.
 * The palette's backup commands land here over the command bus.
 */
export function DataSection(): React.JSX.Element {
  const format = useFormat()
  const storage = useStorageInfo()
  const openDirectory = useOpenDataDirectory()
  const exportBackup = useExportBackup()
  const previewImport = usePreviewBackupImport()
  const commitImport = useCommitBackupImport()
  const clearAll = useClearAllData()
  const exportCalendar = useExportCalendar()

  const [importPreview, setImportPreview] = useState<
    { token: string; summary: BackupImportSummary } | undefined
  >()
  const [importMode, setImportMode] = useState<BackupImportMode>('merge')
  const [clearOpen, setClearOpen] = useState(false)
  const [clearText, setClearText] = useState('')

  const { mutate: runExportMutation } = exportBackup
  const runExport = useCallback(() => {
    runExportMutation(undefined, {
      onSuccess: (result) => {
        if (!result.canceled)
          toastSuccess('Backup exported', `${countsList(result.counts)} → ${result.path}`)
      }
    })
  }, [runExportMutation])
  const { mutate: runPreviewMutation } = previewImport
  const runPreview = useCallback(() => {
    runPreviewMutation(undefined, {
      onSuccess: (result) => {
        if (!result.canceled)
          setImportPreview({ token: result.previewToken, summary: result.summary })
      }
    })
  }, [runPreviewMutation])
  useCommandListener('settings:export-backup', runExport)
  useCommandListener('settings:import-backup', runPreview)

  const runCommit = (): void => {
    if (!importPreview) return
    commitImport.mutate(
      { previewToken: importPreview.token, mode: importMode },
      {
        onSuccess: (result) => {
          setImportPreview(undefined)
          toastSuccess('Backup imported', countsList(result.imported))
        },
        // The token is single-use: whatever happened, the next attempt starts from the file picker.
        onError: () => setImportPreview(undefined)
      }
    )
  }

  const runClear = (): void => {
    clearAll.mutate(undefined, {
      onSuccess: () => {
        setClearOpen(false)
        setClearText('')
        toastSuccess('All local data was cleared')
      }
    })
  }

  const runExportCalendar = (): void => {
    exportCalendar.mutate(
      { scope: { type: 'all' } },
      {
        onSuccess: (result) => {
          if (!result.canceled) toastSuccess(`Exported ${result.count} events`, result.path)
        }
      }
    )
  }

  return (
    <div className="flex flex-col">
      <DataRow
        icon={Database}
        title="Local database"
        description={
          storage.data ? (
            <>
              <span className="font-mono break-all">{storage.data.databasePath}</span>
              <span className="tabular block" data-testid="storage-summary">
                {formatBytes(storage.data.databaseSizeBytes)} · {countsList(storage.data.counts)}
              </span>
            </>
          ) : storage.isError ? (
            <ErrorState
              variant="compact"
              error={storage.error}
              title="Storage details unavailable"
              onRetry={() => void storage.refetch()}
            />
          ) : (
            <LoadingState variant="inline" label="Reading storage…" />
          )
        }
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => openDirectory.mutate()}
          disabled={openDirectory.isPending}
        >
          <FolderOpen aria-hidden="true" />
          Open data directory
        </Button>
      </DataRow>

      <DataRow
        icon={FileJson}
        title="JSON backup"
        description="Export everything (events, deadlines, milestones, habits, subscriptions, settings) to a file you choose. Import shows a preview before anything changes."
      >
        <Button variant="outline" size="sm" onClick={runExport} disabled={exportBackup.isPending}>
          Export backup…
        </Button>
        <Button variant="outline" size="sm" onClick={runPreview} disabled={previewImport.isPending}>
          <Upload aria-hidden="true" />
          Import backup…
        </Button>
      </DataRow>

      <DataRow
        icon={CalendarDays}
        title="Calendar export"
        description="Save all calendar events as an .ics file. Exporting one source, a date range or selected events is available from the Calendar page."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={runExportCalendar}
          disabled={exportCalendar.isPending}
        >
          Export calendar (.ics)…
        </Button>
      </DataRow>

      <DataRow
        icon={Trash2}
        title="Clear all local data"
        description="Deletes every record in the local database. This cannot be undone: export a backup first."
      >
        <Button variant="destructive" size="sm" onClick={() => setClearOpen(true)}>
          Clear all data…
        </Button>
      </DataRow>

      <Dialog
        open={importPreview !== undefined}
        onOpenChange={(open) => !open && setImportPreview(undefined)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Import backup</DialogTitle>
            <DialogDescription>
              Nothing has been changed yet. Review the preview, then choose how to import.
            </DialogDescription>
          </DialogHeader>
          {importPreview && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted/60 p-3 text-xs">
              <dt className="text-muted-foreground">Exported</dt>
              <dd>
                {format.formatDateTime(importPreview.summary.exportedAt)} · app{' '}
                {importPreview.summary.appVersion} · format v{importPreview.summary.formatVersion}
              </dd>
              <dt className="text-muted-foreground">Contains</dt>
              <dd data-testid="import-contains">{countsList(importPreview.summary.counts)}</dd>
              {importPreview.summary.warnings.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Warnings</dt>
                  <dd>
                    <ul className="list-disc pl-4">
                      {importPreview.summary.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}
            </dl>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Import mode</Label>
            <SegmentedControl
              aria-label="Import mode"
              value={importMode}
              onValueChange={setImportMode}
              options={[
                { value: 'merge', label: 'Merge into existing data' },
                { value: 'replace', label: 'Replace everything' }
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {importMode === 'replace'
                ? 'Replace deletes your current data first. Export a backup before continuing.'
                : 'Merge keeps current records and adds the backup’s records; identical ids are updated.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(undefined)}>
              Cancel
            </Button>
            <Button
              variant={importMode === 'replace' ? 'destructive' : 'default'}
              onClick={runCommit}
              disabled={commitImport.isPending}
            >
              {importMode === 'replace' ? 'Replace and import' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={clearOpen}
        onOpenChange={(open) => {
          setClearOpen(open)
          if (!open) setClearText('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all local data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all events, deadlines, conference snapshots, milestones,
              habits and subscriptions from this computer. It cannot be undone. Only the application
              data directory is affected. We recommend exporting a backup first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clear-confirmation">
              Type <span className="font-mono">{CLEAR_ALL_DATA_CONFIRMATION}</span> to confirm
            </Label>
            <Input
              id="clear-confirmation"
              value={clearText}
              onChange={(event) => setClearText(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={clearText !== CLEAR_ALL_DATA_CONFIRMATION || clearAll.isPending}
              onClick={(event) => {
                event.preventDefault()
                runClear()
              }}
            >
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
