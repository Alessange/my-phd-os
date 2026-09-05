import { Plus, Search } from 'lucide-react'
import { useCommandPalette } from '@renderer/app/commands'
import { getPage, useNavigation } from '@renderer/app/navigation'
import { triggerQuickCreate } from '@renderer/app/quickCreate'
import { KeyboardHint } from '@renderer/components/common/KeyboardHint'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { usePlatform } from '@renderer/hooks/usePlatform'
import { formatShortcutLabel } from '@renderer/lib/shortcutLabel'

function LiveClock(): React.JSX.Element {
  const now = useNow({ precision: 'second' })
  const format = useFormat()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={now}
          className="app-no-drag tabular flex items-baseline gap-2 rounded-md px-2 py-1 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          aria-label={`${format.formatWeekday(now)}, ${format.formatDate(now)}, ${format.formatClock(now)}, ${format.formatZoneLabel(now)}`}
        >
          <span className="text-muted-foreground">{format.formatWeekday(now, 'short')}</span>
          <span className="font-medium">{format.formatDate(now)}</span>
          <span className="numeric text-base font-semibold">{format.formatClock(now)}</span>
          <span className="rounded-sm bg-muted px-1 text-[11px] font-medium text-muted-foreground">
            {format.formatZoneLabel(now)}
          </span>
        </time>
      </TooltipTrigger>
      <TooltipContent>{format.zoneName}</TooltipContent>
    </Tooltip>
  )
}

export function TopBar(): React.JSX.Element {
  const pageId = useNavigation((state) => state.page)
  const page = getPage(pageId)
  const openPalette = useCommandPalette((state) => state.setOpen)
  const { isMac } = usePlatform()

  return (
    <header className="app-drag flex h-12 shrink-0 items-center gap-3 border-b bg-background/95 px-4">
      <div className="flex min-w-0 items-center gap-2">
        <page.icon aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="truncate text-[15px] font-semibold tracking-tight">{page.label}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LiveClock />
        <Button
          variant="outline"
          size="sm"
          className="app-no-drag w-56 justify-start text-muted-foreground"
          aria-label={`Open command palette (${formatShortcutLabel('mod+K', isMac)})`}
          onClick={() => openPalette(true)}
        >
          <Search aria-hidden="true" />
          <span className="flex-1 truncate text-left">Search or run a command…</span>
          <KeyboardHint shortcut="mod+K" />
        </Button>
        {page.createLabel && (
          <Button
            size="sm"
            className="app-no-drag"
            aria-label={`Create new ${page.createLabel.toLowerCase()} (${formatShortcutLabel('mod+N', isMac)})`}
            onClick={triggerQuickCreate}
          >
            <Plus aria-hidden="true" />
            New {page.createLabel}
          </Button>
        )}
      </div>
    </header>
  )
}
