import { Check, Eye, EyeOff, Filter, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { getCategory } from '@shared/constants/categories'
import {
  CALENDAR_EVENT_CATEGORIES,
  type CalendarEventCategory,
  type CalendarSource
} from '@shared/types/calendar'
import { DynamicIcon } from '@renderer/components/common/DynamicIcon'
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
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Switch } from '@renderer/components/ui/switch'
import { chipStyle, cn } from '@renderer/lib/utils'
import { useDeleteSource, useUpdateSource } from '../api'

export interface FiltersPopoverProps {
  sources: CalendarSource[]
  /** Categories currently shown. */
  categories: ReadonlySet<CalendarEventCategory>
  onCategoriesChange: (next: Set<CalendarEventCategory>) => void
}

/**
 * Category filter (this session) and calendar sources (spec §10.2: rename, colour, show/hide,
 * delete with or without events). Source visibility is persisted; the event query already skips
 * hidden sources.
 */
export function FiltersPopover({
  sources,
  categories,
  onCategoriesChange
}: FiltersPopoverProps): React.JSX.Element {
  const updateSource = useUpdateSource()
  const deleteSource = useDeleteSource()
  const [renaming, setRenaming] = useState<{ id: string; name: string } | undefined>()
  const [deleting, setDeleting] = useState<CalendarSource | undefined>()
  const [deleteEvents, setDeleteEvents] = useState(false)

  const toggleCategory = (category: CalendarEventCategory): void => {
    const next = new Set(categories)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    onCategoriesChange(next)
  }
  const hiddenCount =
    CALENDAR_EVENT_CATEGORIES.length - categories.size + sources.filter((s) => !s.visible).length

  const commitRename = (): void => {
    if (!renaming) return
    const name = renaming.name.trim()
    if (name.length > 0) updateSource.mutate({ id: renaming.id, patch: { name } })
    setRenaming(undefined)
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Filters and sources">
            <Filter aria-hidden="true" />
            Filters
            {hiddenCount > 0 && (
              <span className="tabular rounded-sm bg-primary/15 px-1 text-[10px] text-primary">
                {hiddenCount} hidden
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-1.5" aria-labelledby="filter-categories">
              <div className="flex items-center justify-between">
                <h3
                  id="filter-categories"
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Categories
                </h3>
                {categories.size < CALENDAR_EVENT_CATEGORIES.length && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0"
                    onClick={() => onCategoriesChange(new Set(CALENDAR_EVENT_CATEGORIES))}
                  >
                    Show all
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CALENDAR_EVENT_CATEGORIES.map((id) => {
                  const definition = getCategory(id)
                  const active = categories.has(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleCategory(id)}
                      style={active ? chipStyle(definition.colorToken) : undefined}
                      className={cn(
                        'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                        active
                          ? 'chip-tint border-transparent'
                          : 'border-border text-muted-foreground line-through hover:bg-accent'
                      )}
                    >
                      <DynamicIcon name={definition.icon} className="size-3" />
                      {definition.label}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="flex flex-col gap-1.5" aria-labelledby="filter-sources">
              <h3
                id="filter-sources"
                className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                Calendar sources
              </h3>
              {sources.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No sources yet. Importing an .ics file creates one.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {sources.map((source) => (
                    <li
                      key={source.id}
                      className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/60"
                      data-source-id={source.id}
                    >
                      <label
                        className="relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full"
                        title="Change colour"
                      >
                        <span
                          className="size-3.5 rounded-full"
                          style={{ backgroundColor: source.color }}
                          aria-hidden="true"
                        />
                        <input
                          type="color"
                          aria-label={`Colour of ${source.name}`}
                          value={source.color}
                          onChange={(e) =>
                            updateSource.mutate({ id: source.id, patch: { color: e.target.value } })
                          }
                          className="absolute inset-0 size-full cursor-pointer opacity-0"
                        />
                      </label>
                      {renaming?.id === source.id ? (
                        <Input
                          aria-label="Source name"
                          value={renaming.name}
                          autoFocus
                          onChange={(e) => setRenaming({ id: source.id, name: e.target.value })}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') setRenaming(undefined)
                          }}
                          className="h-7 flex-1 text-xs"
                        />
                      ) : (
                        <span
                          className={cn(
                            'flex-1 truncate text-sm',
                            !source.visible && 'text-muted-foreground line-through'
                          )}
                        >
                          {source.name}
                          <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                            {source.type}
                          </span>
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Rename ${source.name}`}
                        onClick={() => setRenaming({ id: source.id, name: source.name })}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={source.visible ? `Hide ${source.name}` : `Show ${source.name}`}
                        aria-pressed={source.visible}
                        onClick={() =>
                          updateSource.mutate({
                            id: source.id,
                            patch: { visible: !source.visible }
                          })
                        }
                      >
                        {source.visible ? (
                          <Eye aria-hidden="true" />
                        ) : (
                          <EyeOff aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        aria-label={`Delete ${source.name}`}
                        onClick={() => setDeleting(source)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(undefined)
            setDeleteEvents(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete source “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The source is removed. Choose whether its events go with it or stay as ordinary events
              without a source. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="delete-source-events">Also delete its events</Label>
            <Switch
              id="delete-source-events"
              checked={deleteEvents}
              onCheckedChange={setDeleteEvents}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteSource.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (!deleting) return
                deleteSource.mutate(
                  { id: deleting.id, deleteEvents },
                  {
                    onSuccess: () => {
                      setDeleting(undefined)
                      setDeleteEvents(false)
                    }
                  }
                )
              }}
            >
              <Check aria-hidden="true" />
              {deleteEvents ? 'Delete source and events' : 'Delete source, keep events'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
