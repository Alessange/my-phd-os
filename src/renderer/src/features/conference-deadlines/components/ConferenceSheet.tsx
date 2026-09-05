import { useState } from 'react'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@renderer/components/ui/sheet'
import { useNow } from '@renderer/hooks/useNow'
import {
  useAddToCalendar,
  useFollow,
  useRemoveFromCalendar,
  useUnfollow,
  useUpdateFollow
} from '../api'
import { ConferenceCard } from './ConferenceCard'
import { FollowDialog } from './FollowDialog'

export interface ConferenceSheetProps {
  item?: ConferenceDeadlineView
  open: boolean
  onOpenChange: (open: boolean) => void
  updated?: boolean
}

/** Everything about one conference, on demand: the full card with follow and calendar actions. */
export function ConferenceSheet({
  item,
  open,
  onOpenChange,
  updated = false
}: ConferenceSheetProps): React.JSX.Element {
  const nowIso = useNow({ precision: 'minute' })
  const follow = useFollow()
  const unfollow = useUnfollow()
  const updateFollow = useUpdateFollow()
  const addToCalendar = useAddToCalendar()
  const removeFromCalendar = useRemoveFromCalendar()
  const [editingFollow, setEditingFollow] = useState(false)
  const busy =
    follow.isPending ||
    unfollow.isPending ||
    addToCalendar.isPending ||
    removeFromCalendar.isPending

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{item?.title ?? 'Conference'}</SheetTitle>
            <SheetDescription>
              {item?.fullName ??
                'Details from CCF Deadlines. Canonical dates cannot be edited here.'}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            {item && (
              <ConferenceCard
                item={item}
                nowIso={nowIso}
                updated={updated}
                busy={busy}
                compactHeader
                onFollow={(c) => follow.mutate({ id: c.id })}
                onUnfollow={(c) =>
                  unfollow.mutate({ id: c.id }, { onSuccess: () => onOpenChange(false) })
                }
                onEditFollow={() => setEditingFollow(true)}
                onAddToCalendar={(c) => addToCalendar.mutate({ id: c.id })}
                onRemoveFromCalendar={(c) => removeFromCalendar.mutate({ id: c.id })}
              />
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
      <FollowDialog
        item={item}
        open={editingFollow && item !== undefined}
        onOpenChange={setEditingFollow}
        onSave={(c, patch) => updateFollow.mutateAsync({ id: c.id, patch })}
      />
    </>
  )
}
