import { Ellipsis, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { getCategory } from '@shared/constants/categories'
import {
  CALENDAR_EVENT_CATEGORIES,
  type CalendarEventCategory,
  type CalendarSource
} from '@shared/types/calendar'
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
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Switch } from '@renderer/components/ui/switch'
import { cn, userColor } from '@renderer/lib/utils'
import { useDeleteSource, useUpdateSource } from '../api'

export interface FiltersPopoverProps {
  sources: CalendarSource[]
  /** Categories currently shown. */
  categories: ReadonlySet<CalendarEventCategory>
  onCategoriesChange: (next: Set<CalendarEventCategory>) => void
  onImport: () => void
  onExport: () => void
}

/** A menu row that acts like a text button: 36 px high, label left, hint right. */
const menuRow =
  'flex h-9 w-full items-center justify-between rounded-sm px-2 text-sm text-ink hover:bg-hover'

/**
 * The Calendars menu (the `...` at the right of the toolbar): the calendar sources (show / hide,
 * rename, colour, delete with or without events), the category filter (this session only) and the
 * two `.ics` entries. Source visibility is persisted; the event query already skips hidden
 * sources. A source's stored colour is drawn as a 6 px normalised dot, never on the grid.
 */
export function FiltersPopover({
  sources,
  categories,
  onCategoriesChange,
  onImport,
  onExport
}: FiltersPopoverProps): React.JSX.Element {
  const updateSource = useUpdateSource()
  const deleteSource = useDeleteSource()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | undefined>()
  const [deleting, setDeleting] = useState<CalendarSource | undefined>()
  const [deleteEvents, setDeleteEvents] = useState(false)
  const [showCategories, setShowCategories] = useState(false)

  const toggleCategory = (category: CalendarEventCategory): void => {
    const next = new Set(categories)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    onCategoriesChange(next)
  }
  const hiddenCategories = CALENDAR_EVENT_CATEGORIES.length - categories.size
  const hiddenCount = hiddenCategories + sources.filter((s) => !s.visible).length

  const commitRename = (): void => {
    if (!renaming) return
    const name = renaming.name.trim()
    if (name.length > 0) updateSource.mutate({ id: renaming.id, patch: { name } })
    setRenaming(undefined)
  }
  const choose = (action: () => void): void => {
    setOpen(false)
    action()
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size={hiddenCount > 0 ? 'sm' : 'icon'}
            aria-label={`Calendars and filters${hiddenCount > 0 ? `, ${hiddenCount} hidden` : ''}`}
          >
            {hiddenCount > 0 && (
              <span className="tabular text-xs text-ink-3">{hiddenCount} hidden</span>
            )}
            <Ellipsis aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3">
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-1" aria-labelledby="menu-calendars">
              <div className="flex items-baseline justify-between px-2">
                <h3 id="menu-calendars" className="text-sm text-ink-2">
                  Calendars
                </h3>
                {hiddenCount > 0 && (
                  <span className="tabular text-xs text-ink-3">{hiddenCount} hidden</span>
                )}
              </div>
              {sources.length === 0 ? (
                <p className="px-2 py-1 text-xs text-ink-3">
                  No sources yet. Importing an .ics file creates one.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {sources.map((source) => (
                    <li
                      key={source.id}
                      className="group/row flex min-h-9 items-center gap-0.5"
                      data-source-id={source.id}
                    >
                      <label
                        className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center"
                        title="Change colour"
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: userColor(source.color) }}
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
                          className="h-8 flex-1 text-sm"
                        />
                      ) : (
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-sm',
                            !source.visible && 'text-ink-3'
                          )}
                        >
                          {source.name}
                          <span className="ml-2 text-xs text-ink-3">{source.type}</span>
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
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
                        variant="destructive"
                        size="icon"
                        className="size-7 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
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

            <section className="flex flex-col gap-1" aria-labelledby="menu-categories">
              <div className="flex items-baseline justify-between px-2">
                <h3 id="menu-categories" className="text-sm text-ink-2">
                  <button
                    type="button"
                    className="hover:text-ink"
                    aria-expanded={showCategories}
                    aria-controls="menu-category-list"
                    onClick={() => setShowCategories((value) => !value)}
                  >
                    Categories
                  </button>
                </h3>
                {hiddenCategories > 0 && (
                  <button
                    type="button"
                    className="link-quiet text-xs"
                    onClick={() => onCategoriesChange(new Set(CALENDAR_EVENT_CATEGORIES))}
                  >
                    Show all
                  </button>
                )}
              </div>
              {(showCategories || hiddenCategories > 0) && (
                <ul id="menu-category-list" className="grid grid-cols-2 gap-x-2">
                  {CALENDAR_EVENT_CATEGORIES.map((id) => (
                    <li key={id} className="flex h-8 items-center gap-2 px-2">
                      <Checkbox
                        id={`menu-category-${id}`}
                        checked={categories.has(id)}
                        onCheckedChange={() => toggleCategory(id)}
                      />
                      <Label variant="inline" htmlFor={`menu-category-${id}`} className="min-w-0">
                        <span className="truncate">{getCategory(id).label}</span>
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex flex-col border-t border-line pt-2">
              <button
                type="button"
                className={menuRow}
                aria-label="Import .ics"
                onClick={() => choose(onImport)}
              >
                <span>Import .ics</span>
                <span className="text-xs text-ink-3" aria-hidden="true">
                  ⌘I
                </span>
              </button>
              <button
                type="button"
                className={menuRow}
                aria-label="Export .ics"
                onClick={() => choose(onExport)}
              >
                Export .ics
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={deleting !== undefined}
        onOpenChange={(next) => {
          if (!next) {
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
          <div className="flex items-center justify-between border-y border-line py-3">
            <Label variant="inline" htmlFor="delete-source-events">
              Also delete its events
            </Label>
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
              {deleteEvents ? 'Delete source and events' : 'Delete source, keep events'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
