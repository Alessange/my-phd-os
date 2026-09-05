import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Database, FileJson, FolderOpen, Trash2, Upload } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  CLEAR_ALL_DATA_CONFIRMATION,
  type BackupImportMode,
  type BackupImportSummary
} from '@shared/types/data'
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
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/queryKeys'
import { toastError, toastSuccess } from '@renderer/lib/toast'

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
          <p className="text-xs text-muted-foreground">{description}</p>
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

/**
 * Settings › Data. Storage info + export are wired to their channels; import shows the preview
 * before committing; clearing needs a typed confirmation. The settings-data feature owns this file
 * and may extend it (progress, richer previews) — TODO(feature: settings-data).
 */
export function DataSection(): React.JSX.Element {
  const info = useQuery({ queryKey: queryKeys.app.info(), queryFn: () => api('app:getInfo') })
  const [busy, setBusy] = useState<string | undefined>()
  const [importPreview, setImportPreview] = useState<
    { token: string; summary: BackupImportSummary } | undefined
  >()
  const [importMode, setImportMode] = useState<BackupImportMode>('merge')
  const [clearOpen, setClearOpen] = useState(false)
  const [clearText, setClearText] = useState('')

  const runAction = async (id: string, action: () => Promise<void>): Promise<void> => {
    setBusy(id)
    try {
      await action()
    } catch (error) {
      toastError(error, { retry: () => runAction(id, action) })
    } finally {
      setBusy(undefined)
    }
  }

  const openDirectory = (): Promise<void> =>
    runAction('open', async () => {
      await api('app:openDataDirectory')
    })

  const exportBackup = (): Promise<void> =>
    runAction('export', async () => {
      const result = await api('data:exportBackup')
      if (!result.canceled) toastSuccess('Backup exported', result.path)
    })

  const exportCalendar = (): Promise<void> =>
    runAction('exportIcs', async () => {
      const result = await api('calendar:exportIcs', { scope: { type: 'all' } })
      if (!result.canceled) toastSuccess(`Exported ${result.count} events`, result.path)
    })

  const previewImport = (): Promise<void> =>
    runAction('import', async () => {
      const result = await api('data:previewBackupImport')
      if (!result.canceled)
        setImportPreview({ token: result.previewToken, summary: result.summary })
    })

  const commitImport = (): Promise<void> =>
    runAction('commit', async () => {
      if (!importPreview) return
      const result = await api('data:commitBackupImport', {
        previewToken: importPreview.token,
        mode: importMode
      })
      setImportPreview(undefined)
      toastSuccess('Backup imported', countsList(result.imported))
    })

  const clearAll = (): Promise<void> =>
    runAction('clear', async () => {
      await api('data:clearAllData', { confirmation: CLEAR_ALL_DATA_CONFIRMATION })
      setClearOpen(false)
      setClearText('')
      toastSuccess('All local data was cleared')
    })

  return (
    <div className="flex flex-col">
      <DataRow
        icon={Database}
        title="Local database"
        description={
          info.data ? (
            <span className="font-mono break-all">{info.data.databasePath}</span>
          ) : info.error ? (
            'Database location unavailable.'
          ) : (
            <LoadingState variant="inline" label="Locating database…" />
          )
        }
      >
        <Button variant="outline" size="sm" onClick={openDirectory} disabled={busy === 'open'}>
          <FolderOpen aria-hidden="true" />
          Open data directory
        </Button>
      </DataRow>

      <DataRow
        icon={FileJson}
        title="JSON backup"
        description="Export everything (events, deadlines, milestones, habits, subscriptions, settings) to a file you choose. Import shows a preview before anything changes."
      >
        <Button variant="outline" size="sm" onClick={exportBackup} disabled={busy === 'export'}>
          Export backup…
        </Button>
        <Button variant="outline" size="sm" onClick={previewImport} disabled={busy === 'import'}>
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
          onClick={exportCalendar}
          disabled={busy === 'exportIcs'}
        >
          Export calendar (.ics)…
        </Button>
      </DataRow>

      <DataRow
        icon={Trash2}
        title="Clear all local data"
        description="Deletes every record in the local database. This cannot be undone — export a backup first."
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
                {importPreview.summary.exportedAt} · app {importPreview.summary.appVersion} · format
                v{importPreview.summary.formatVersion}
              </dd>
              <dt className="text-muted-foreground">Contains</dt>
              <dd>{countsList(importPreview.summary.counts)}</dd>
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
              onClick={commitImport}
              disabled={busy === 'commit'}
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
              disabled={clearText !== CLEAR_ALL_DATA_CONFIRMATION || busy === 'clear'}
              onClick={(event) => {
                event.preventDefault()
                void clearAll()
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
