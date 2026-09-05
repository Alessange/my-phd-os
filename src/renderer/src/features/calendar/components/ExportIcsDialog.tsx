import { Download } from 'lucide-react'
import { useState } from 'react'
import { addDays, isAllDayDate, todayInZone } from '@shared/dates'
import type { CalendarSource, IcsExportScope } from '@shared/types/calendar'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { toastSuccess } from '@renderer/lib/toast'
import { useExportIcs } from '../api'

type ScopeKind = 'all' | 'source' | 'range'

export interface ExportIcsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sources: CalendarSource[]
}

/** `.ics` export (spec §10.3): the whole calendar, one source, or a date range, through the native save dialog. */
export function ExportIcsDialog({
  open,
  onOpenChange,
  sources
}: ExportIcsDialogProps): React.JSX.Element {
  const { zone } = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const today = todayInZone(zone, nowIso)
  const exportIcs = useExportIcs()
  const [kind, setKind] = useState<ScopeKind>('all')
  const [sourceId, setSourceId] = useState('')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(addDays(today, 30))

  const scope: IcsExportScope | undefined =
    kind === 'all'
      ? { type: 'all' }
      : kind === 'source'
        ? sourceId
          ? { type: 'source', sourceId }
          : undefined
        : isAllDayDate(start) && isAllDayDate(end) && start < end
          ? { type: 'range', start, end: addDays(end, 1) }
          : undefined

  const run = (): void => {
    if (!scope) return
    exportIcs.mutate(
      { scope },
      {
        onSuccess: (result) => {
          if (!result.canceled) {
            toastSuccess(
              `Exported ${result.count} event${result.count === 1 ? '' : 's'}`,
              result.path
            )
            onOpenChange(false)
          }
        }
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Export calendar (.ics)</DialogTitle>
          <DialogDescription>
            UID, title, description, location, times, timezone, all-day state and recurrence are
            preserved.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <SegmentedControl
            aria-label="Export scope"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: 'all', label: 'Everything' },
              { value: 'source', label: 'One source' },
              { value: 'range', label: 'Date range' }
            ]}
          />
          {kind === 'source' && (
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="w-full" aria-label="Source to export">
                <SelectValue placeholder={sources.length ? 'Choose a source' : 'No sources yet'} />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {kind === 'range' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-start">From</Label>
                <Input
                  id="export-start"
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-end">To (inclusive)</Label>
                <Input
                  id="export-end"
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  aria-invalid={!(start < end)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={run} disabled={!scope || exportIcs.isPending}>
            <Download aria-hidden="true" />
            Export…
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
