import { CircleAlert } from 'lucide-react'
import { useCallback, useState } from 'react'
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
import { SettingRow } from './GeneralSection'
import { toastSuccess } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import {
  useClearAllData,
  useCommitBackupImport,
  useExportBackup,
  useExportCalendar,
  useOpenDataDirectory,
  usePreviewBackupImport,
  useStorageInfo
} from '../api'

/** A quiet text action inside a row (DESIGN.md 6: actions in lists are text links). */
function TextAction({
  danger = false,
  className,
  ...props
}: React.ComponentProps<'button'> & { danger?: boolean }): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        danger ? 'link text-signal' : 'link',
        'text-body disabled:no-underline disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

const countsList = (counts: BackupImportSummary['counts']): string =>
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([entity, n]) => {
      const name = entity.replace(/([A-Z])/g, ' $1').toLowerCase()
      // Every entity name is a plural noun: "1 habit", "2 habits".
      return `${n} ${n === 1 ? name.replace(/s$/, '') : name}`
    })
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
      <SettingRow
        label="Local database"
        detail={
          storage.data ? (
            <>
              <span className="tabular block [overflow-wrap:anywhere]">
                {storage.data.databasePath}
              </span>
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
        <TextAction onClick={() => openDirectory.mutate()} disabled={openDirectory.isPending}>
          Open data directory
        </TextAction>
      </SettingRow>

      <SettingRow
        label="JSON backup"
        description="Events, deadlines, milestones, habits, subscriptions and settings. Import shows a preview first."
      >
        <TextAction onClick={runExport} disabled={exportBackup.isPending}>
          Export backup…
        </TextAction>
        <TextAction onClick={runPreview} disabled={previewImport.isPending}>
          Import backup…
        </TextAction>
      </SettingRow>

      <SettingRow
        label="Calendar export"
        description="All calendar events as an .ics file. One source, a date range or selected events is exported from the Calendar page."
      >
        <TextAction onClick={runExportCalendar} disabled={exportCalendar.isPending}>
          Export calendar (.ics)…
        </TextAction>
      </SettingRow>

      <SettingRow
        label="Clear all local data"
        description="Deletes every record in the local database. This cannot be undone: export a backup first."
      >
        <TextAction danger onClick={() => setClearOpen(true)}>
          Clear all data…
        </TextAction>
      </SettingRow>

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
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 border-y border-line py-4 text-body">
              <dt className="text-ink-3">Exported</dt>
              <dd className="tabular">
                {format.formatDateTime(importPreview.summary.exportedAt)} · app{' '}
                {importPreview.summary.appVersion} · format v{importPreview.summary.formatVersion}
              </dd>
              <dt className="text-ink-3">Contains</dt>
              <dd className="tabular" data-testid="import-contains">
                {countsList(importPreview.summary.counts)}
              </dd>
              {importPreview.summary.warnings.length > 0 && (
                <>
                  <dt className="text-ink-3">Warnings</dt>
                  <dd>
                    <ul className="flex flex-col gap-1">
                      {importPreview.summary.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}
            </dl>
          )}
          <div className="flex flex-col gap-1">
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
            {importMode === 'replace' ? (
              <p className="flex items-baseline gap-1.5 text-meta text-signal">
                <CircleAlert aria-hidden="true" className="size-3.5 shrink-0 translate-y-0.5" />
                Replace deletes your current data first. Export a backup before continuing.
              </p>
            ) : (
              <p className="text-meta text-ink-2">
                Merge keeps current records and adds the backup’s records; identical ids are
                updated.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportPreview(undefined)}>
              Cancel
            </Button>
            <Button onClick={runCommit} disabled={commitImport.isPending}>
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
              habits and subscriptions from this computer. It cannot be undone, and only the
              application data directory is affected. Export a backup first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="clear-confirmation">
              <span>
                Type <span className="tabular text-ink">{CLEAR_ALL_DATA_CONFIRMATION}</span> to
                confirm
              </span>
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
