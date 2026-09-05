import { FileUp, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ICS_DUPLICATE_REASON_LABELS } from '@shared/constants/statuses'
import type { IcsConflictPolicy, IcsFileInput, IcsImportPreview } from '@shared/types/calendar'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { ICS_IMPORT_ITEM_STATUS_DEFINITIONS } from '@shared/constants/statuses'
import { Badge } from '@renderer/components/ui/badge'
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
import { LoadingState } from '@renderer/components/common/LoadingState'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useFormat } from '@renderer/hooks/useFormat'
import { toastSuccess } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import {
  useCalendarSources,
  useCommitIcsImport,
  usePickIcsFiles,
  usePreviewIcsImport
} from '../api'
import { readDroppedIcsFiles } from '../lib/dropFiles'

const SOURCE_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
  '#64748b'
] as const

const POLICY_OPTIONS: readonly { value: IcsConflictPolicy; label: string }[] = [
  { value: 'skip', label: 'Skip duplicates' },
  { value: 'replace', label: 'Replace existing' },
  { value: 'keepBoth', label: 'Keep both' }
]

const formatBytes = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

export interface IcsImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Files dropped onto the page; previewed as soon as the dialog opens. */
  droppedFiles?: IcsFileInput[]
}

/**
 * `.ics` import (spec §10): choose files (native picker or drop), review the preview (counts, date
 * range, samples, duplicates, invalid files), pick a conflict policy and a target source, confirm.
 * Nothing is written until "Import".
 */
export function IcsImportDialog({
  open,
  onOpenChange,
  droppedFiles
}: IcsImportDialogProps): React.JSX.Element {
  const format = useFormat()
  const sources = useCalendarSources()
  const pick = usePickIcsFiles()
  const preview = usePreviewIcsImport()
  const commit = useCommitIcsImport()
  const [result, setResult] = useState<IcsImportPreview | undefined>()
  const [policy, setPolicy] = useState<IcsConflictPolicy>('skip')
  const [sourceMode, setSourceMode] = useState<'new' | 'existing'>('new')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(SOURCE_COLORS[0])
  const [existingId, setExistingId] = useState<string>('')
  const [dragging, setDragging] = useState(false)
  const lastDropped = useRef<IcsFileInput[] | undefined>(undefined)

  const runPreview = (files: IcsFileInput[]): void => {
    if (files.length === 0) return
    preview.mutate(
      { files },
      {
        onSuccess: (previewResult) => {
          setResult(previewResult)
          setNewName(
            files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : 'Imported calendar'
          )
        }
      }
    )
  }

  // Files dropped on the page arrive through props: preview them once per drop.
  useEffect(() => {
    if (open && droppedFiles && droppedFiles !== lastDropped.current) {
      lastDropped.current = droppedFiles
      runPreview(droppedFiles)
    }
    if (!open) lastDropped.current = undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runPreview is stable for the dialog's lifetime
  }, [open, droppedFiles])

  const close = (nextOpen: boolean): void => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setResult(undefined)
      setPolicy('skip')
      setSourceMode('new')
      setExistingId('')
    }
  }

  const onDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault()
    setDragging(false)
    runPreview(await readDroppedIcsFiles(event.dataTransfer.files))
  }

  const existingSources = sources.data ?? []
  const canImport =
    result !== undefined &&
    result.recognizedEvents > 0 &&
    (sourceMode === 'new' ? newName.trim().length > 0 : existingId.length > 0) &&
    !commit.isPending

  const runCommit = (): void => {
    if (!result) return
    commit.mutate(
      {
        previewToken: result.previewToken,
        conflictPolicy: policy,
        source:
          sourceMode === 'new'
            ? { mode: 'new', name: newName.trim(), color: newColor }
            : { mode: 'existing', id: existingId }
      },
      {
        onSuccess: (imported) => {
          toastSuccess(
            `Imported ${imported.imported} event${imported.imported === 1 ? '' : 's'}`,
            [
              imported.replaced ? `${imported.replaced} replaced` : '',
              imported.skipped ? `${imported.skipped} skipped` : ''
            ]
              .filter(Boolean)
              .join(' · ') || undefined
          )
          close(false)
        },
        // The preview token is single-use; start again from the file picker.
        onError: () => setResult(undefined)
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg" className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import .ics</DialogTitle>
          <DialogDescription>
            Files are parsed on this computer. Review the preview; nothing changes until you import.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div
            role="group"
            aria-label="Choose .ics files"
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => void onDrop(e)}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border'
            )}
          >
            <FileUp className="size-8 text-muted-foreground" aria-hidden="true" />
            <div className="text-sm">
              Drop one or more <span className="font-mono">.ics</span> files here
            </div>
            <div className="text-xs text-muted-foreground">or</div>
            <Button
              onClick={() =>
                pick.mutate(undefined, {
                  onSuccess: (picked) => {
                    if (!picked.canceled) runPreview(picked.files)
                  }
                })
              }
              disabled={pick.isPending || preview.isPending}
            >
              <Upload aria-hidden="true" />
              Choose files…
            </Button>
            {preview.isPending && <LoadingState variant="inline" label="Reading files…" />}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted/60 p-3 text-xs">
              <dt className="text-muted-foreground">Files</dt>
              <dd className="flex flex-col gap-0.5">
                {result.files.map((file) => (
                  <span key={file.name}>
                    <span className="font-medium">{file.name}</span> · {formatBytes(file.sizeBytes)}{' '}
                    · {file.eventCount} event{file.eventCount === 1 ? '' : 's'}
                    {file.warnings.length > 0 && (
                      <ul className="mt-0.5 list-disc pl-4 text-muted-foreground">
                        {file.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </span>
                ))}
                {result.invalidFiles.map((file) => (
                  <span key={file.name} className="text-destructive">
                    {file.name}: {file.reason}
                  </span>
                ))}
              </dd>
              <dt className="text-muted-foreground">Recognised</dt>
              <dd data-testid="import-recognized">
                {result.recognizedEvents} event{result.recognizedEvents === 1 ? '' : 's'}
              </dd>
              {result.dateRange && (
                <>
                  <dt className="text-muted-foreground">Range</dt>
                  <dd className="tabular">
                    {format.formatDate(result.dateRange.start)} –{' '}
                    {format.formatDate(result.dateRange.end)}
                  </dd>
                </>
              )}
              {result.warnings.map((warning) => (
                <dd key={warning} className="col-span-2 text-status-at-risk">
                  {warning}
                </dd>
              ))}
            </dl>

            {result.sampleEvents.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Preview
                </h3>
                <ul className="divide-y rounded-md border text-sm">
                  {result.sampleEvents.map((sample) => (
                    <li
                      key={sample.key}
                      className="flex items-center justify-between gap-3 px-3 py-1.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'truncate',
                            sample.cancelled && 'line-through text-muted-foreground'
                          )}
                        >
                          {sample.title}
                        </span>
                        {sample.recurring && <Badge variant="outline">Repeats</Badge>}
                        {sample.cancelled && <Badge variant="outline">Cancelled</Badge>}
                      </span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {format.formatDateRange(sample.startAt, sample.endAt, {
                          allDay: sample.allDay
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                {result.recognizedEvents > result.sampleEvents.length && (
                  <p className="text-xs text-muted-foreground">
                    Showing the first {result.sampleEvents.length} of {result.recognizedEvents}.
                  </p>
                )}
              </div>
            )}

            {result.conflicts.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-status-at-risk/40 bg-status-at-risk/6 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <StatusBadge status={ICS_IMPORT_ITEM_STATUS_DEFINITIONS.duplicate} size="sm" />
                  {result.conflicts.length} of {result.recognizedEvents} events already exist
                </div>
                <ul className="max-h-40 overflow-y-auto text-xs">
                  {result.conflicts.slice(0, 20).map((conflict) => (
                    <li key={conflict.key} className="flex justify-between gap-3 py-0.5">
                      <span className="truncate">{conflict.incoming.title}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {ICS_DUPLICATE_REASON_LABELS[conflict.reason]} · “{conflict.existingTitle}”
                      </span>
                    </li>
                  ))}
                  {result.conflicts.length > 20 && (
                    <li className="text-muted-foreground">
                      … and {result.conflicts.length - 20} more
                    </li>
                  )}
                </ul>
                <SegmentedControl
                  aria-label="Conflict policy"
                  size="sm"
                  value={policy}
                  onValueChange={setPolicy}
                  options={POLICY_OPTIONS}
                />
                <p className="text-xs text-muted-foreground">
                  {policy === 'skip'
                    ? 'Existing events are kept; matching imports are skipped.'
                    : policy === 'replace'
                      ? 'Existing events are updated with the imported data (same ids).'
                      : 'Imported events are added alongside the existing ones.'}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Calendar source</Label>
              <SegmentedControl
                aria-label="Calendar source"
                size="sm"
                value={sourceMode}
                onValueChange={setSourceMode}
                options={[
                  { value: 'new', label: 'New source' },
                  { value: 'existing', label: 'Existing source' }
                ]}
                disabled={existingSources.length === 0}
              />
              {sourceMode === 'new' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Source name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-56"
                    placeholder="Source name"
                  />
                  <div
                    className="flex items-center gap-1.5"
                    role="group"
                    aria-label="Source colour"
                  >
                    {SOURCE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Colour ${color}`}
                        aria-pressed={newColor === color}
                        onClick={() => setNewColor(color)}
                        className={cn(
                          'size-5 rounded-full border-2',
                          newColor === color ? 'border-foreground' : 'border-transparent'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <Select value={existingId} onValueChange={setExistingId}>
                  <SelectTrigger className="w-64" aria-label="Existing source">
                    <SelectValue placeholder="Choose a source" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {result && (
            <Button
              variant="ghost"
              onClick={() => setResult(undefined)}
              disabled={commit.isPending}
            >
              Choose other files
            </Button>
          )}
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          {result && (
            <Button onClick={runCommit} disabled={!canImport}>
              Import{' '}
              {result.recognizedEvents > 0
                ? `${result.recognizedEvents} event${result.recognizedEvents === 1 ? '' : 's'}`
                : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
