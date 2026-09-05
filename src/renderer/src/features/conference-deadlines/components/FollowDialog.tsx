import { useState } from 'react'
import {
  FOLLOW_INTENTION_DESCRIPTIONS,
  FOLLOW_INTENTION_LABELS
} from '@shared/constants/conferenceLabels'
import type { UpdateFollowPatch } from '@shared/schemas/conference'
import {
  FOLLOW_INTENTIONS,
  type ConferenceDeadlineView,
  type FollowIntention
} from '@shared/types/conference'
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
import { Slider } from '@renderer/components/ui/slider'
import { Textarea } from '@renderer/components/ui/textarea'
import { clampPercent } from '@renderer/lib/utils'

export interface FollowDialogProps {
  item?: ConferenceDeadlineView
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Resolves when saved; rejections are toasted by the mutation hook. */
  onSave: (item: ConferenceDeadlineView, patch: UpdateFollowPatch) => Promise<unknown>
}

/**
 * User-owned follow details (spec §12.6): intention, optional submission progress and notes.
 * These never touch the canonical upstream record.
 */
export function FollowDialog({
  item,
  open,
  onOpenChange,
  onSave
}: FollowDialogProps): React.JSX.Element {
  const [intention, setIntention] = useState<FollowIntention>('watching')
  const [progress, setProgress] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [seed, setSeed] = useState<string | undefined>()
  const seedKey = open && item ? `${item.id}:${item.followed?.followedAt ?? ''}` : undefined
  if (seedKey !== seed) {
    setSeed(seedKey)
    if (item) {
      setIntention(item.followed?.intention ?? 'watching')
      setProgress(item.followed?.progress ?? 0)
      setNotes(item.followed?.notes ?? '')
    }
  }

  const save = async (): Promise<void> => {
    if (!item) return
    setSaving(true)
    try {
      await onSave(item, { intention, progress: clampPercent(progress), notes: notes.trim() })
      onOpenChange(false)
    } catch {
      // The mutation hook already toasted the failure with a retry; keep the dialog open.
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Following {item?.title ?? 'conference'}</DialogTitle>
          <DialogDescription>
            Your intention, progress and notes are private to this computer and never change the
            conference record.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Intention</Label>
            <SegmentedControl
              aria-label="Intention"
              size="sm"
              value={intention}
              onValueChange={setIntention}
              options={FOLLOW_INTENTIONS.map((value) => ({
                value,
                label: FOLLOW_INTENTION_LABELS[value]
              }))}
            />
            <p className="text-[11px] text-muted-foreground">
              {FOLLOW_INTENTION_DESCRIPTIONS[intention]}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="follow-progress">Submission progress (optional)</Label>
            <div className="flex items-center gap-3">
              <Slider
                aria-label="Submission progress"
                value={[progress]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) => setProgress(value ?? 0)}
                className="flex-1"
              />
              <Input
                id="follow-progress"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(clampPercent(Number(e.target.value) || 0))}
                className="w-20"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="follow-notes">Notes</Label>
            <Textarea
              id="follow-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ideas, co-authors, what still needs to happen…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !item}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
