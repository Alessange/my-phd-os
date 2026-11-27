import { CircleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ICS_DUPLICATE_REASON_LABELS } from '@shared/constants/statuses'
import type { IcsConflictPolicy, IcsFileInput, IcsImportPreview } from '@shared/types/calendar'
import { ColourSwatchPicker } from '@renderer/components/common/ColourSwatchPicker'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { ICS_IMPORT_ITEM_STATUS_DEFINITIONS } from '@shared/constants/statuses'
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
import { COLOUR_SWATCHES } from '@renderer/lib/colourSwatches'
import { cn } from '@renderer/lib/utils'
import {
  useCalendarSources,
  useCommitIcsImport,
  usePickIcsFiles,
  usePreviewIcsImport
} from '../api'
import { readDroppedIcsFiles } from '../lib/dropFiles'

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
  const [newColor, setNewColor] = useState<string>(COLOUR_SWATCHES[0])
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
      <DialogContent size="lg">
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
              'flex flex-col items-start gap-4 border-y border-line px-0 py-8 transition-colors',
              dragging && 'bg-selected'
            )}
          >
            <p className="text-sm text-ink-2">Drop one or more .ics files here, or choose them.</p>
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
              Choose files…
            </Button>
            {preview.isPending && <LoadingState variant="inline" label="Reading files…" />}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-6">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-ink-3">Files</dt>
              <dd className="flex flex-col gap-0.5">
                {result.files.map((file) => (
                  <span key={file.name}>
                    {file.name} <span className="text-ink-3">·</span> {formatBytes(file.sizeBytes)}{' '}
                    <span className="text-ink-3">·</span> {file.eventCount} event
                    {file.eventCount === 1 ? '' : 's'}
                    {file.warnings.length > 0 && (
                      <ul className="mt-0.5 flex flex-col gap-0.5 text-xs text-ink-3">
                        {file.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </span>
                ))}
                {result.invalidFiles.map((file) => (
                  <span key={file.name} className="flex items-center gap-1.5 text-xs text-signal">
                    <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    {file.name}: {file.reason}
                  </span>
                ))}
              </dd>
              <dt className="text-ink-3">Recognised</dt>
              <dd data-testid="import-recognized">
                {result.recognizedEvents} event{result.recognizedEvents === 1 ? '' : 's'}
              </dd>
              {result.dateRange && (
                <>
                  <dt className="text-ink-3">Range</dt>
                  <dd className="tabular">
                    {format.formatDate(result.dateRange.start)} –{' '}
                    {format.formatDate(result.dateRange.end)}
                  </dd>
                </>
              )}
              {result.warnings.map((warning) => (
                <dd key={warning} className="col-span-2 text-xs text-ink-2">
                  {warning}
                </dd>
              ))}
            </dl>

            {result.sampleEvents.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="text-sm text-ink-2">Preview</h3>
                <ul className="divide-y divide-line border-y border-line text-sm">
                  {result.sampleEvents.map((sample) => (
                    <li key={sample.key} className="flex items-baseline justify-between gap-4 py-2">
                      <span className="flex min-w-0 items-baseline gap-3">
                        <span
                          className={cn('truncate', sample.cancelled && 'text-ink-3 line-through')}
                        >
                          {sample.title}
                        </span>
                        {sample.recurring && <span className="text-xs text-ink-3">Repeats</span>}
                        {sample.cancelled && <span className="text-xs text-ink-3">Cancelled</span>}
                      </span>
                      <span className="tabular shrink-0 text-xs text-ink-3">
                        {format.formatDateRange(sample.startAt, sample.endAt, {
                          allDay: sample.allDay
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                {result.recognizedEvents > result.sampleEvents.length && (
                  <p className="text-xs text-ink-3">
                    Showing the first {result.sampleEvents.length} of {result.recognizedEvents}.
                  </p>
                )}
              </div>
            )}

            {result.conflicts.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <StatusBadge status={ICS_IMPORT_ITEM_STATUS_DEFINITIONS.duplicate} size="sm" />
                  {result.conflicts.length} of {result.recognizedEvents} events already exist
                </div>
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs">
                  {result.conflicts.slice(0, 20).map((conflict) => (
                    <li key={conflict.key} className="flex justify-between gap-4">
                      <span className="truncate">{conflict.incoming.title}</span>
                      <span className="shrink-0 text-ink-3">
                        {ICS_DUPLICATE_REASON_LABELS[conflict.reason]} · “{conflict.existingTitle}”
                      </span>
                    </li>
                  ))}
                  {result.conflicts.length > 20 && (
                    <li className="text-ink-3">… and {result.conflicts.length - 20} more</li>
                  )}
                </ul>
                <SegmentedControl
                  aria-label="Conflict policy"
                  size="sm"
                  value={policy}
                  onValueChange={setPolicy}
                  options={POLICY_OPTIONS}
                />
                <p className="text-xs text-ink-2">
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
                <div className="flex flex-col gap-3">
                  <Input
                    aria-label="Source name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Source name"
                  />
                  <ColourSwatchPicker
                    value={newColor}
                    onChange={setNewColor}
                    label="Source colour"
                  />
                </div>
              ) : (
                <Select value={existingId} onValueChange={setExistingId}>
                  <SelectTrigger className="w-full" aria-label="Existing source">
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
              className="sm:mr-auto"
            >
              Choose other files
            </Button>
          )}
          <Button variant="ghost" onClick={() => close(false)}>
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
