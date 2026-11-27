import { Search } from 'lucide-react'
import { useCommandPalette } from '@renderer/app/commands'
import { getPage, resolveCreateAction, useNavigation } from '@renderer/app/navigation'
import { triggerQuickCreate } from '@renderer/app/quickCreate'
import { useShell } from '@renderer/app/shell'
import { usePageActionHost } from '@renderer/components/common/pageActionContext'
import { KeyboardHint } from '@renderer/components/common/KeyboardHint'
import { Button } from '@renderer/components/ui/button'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { usePlatform } from '@renderer/hooks/usePlatform'
import { useSettings } from '@renderer/hooks/useSettings'
import { formatShortcutLabel } from '@renderer/lib/shortcutLabel'
import { cn } from '@renderer/lib/utils'

/**
 * `Thursday, Nov 26, 2026 · 18:48 PST`: minute precision (nothing ticks in the chrome; seconds
 * exist only inside countdowns under 24 h). The zone name is the tooltip text.
 */
function Dateline(): React.JSX.Element {
  const now = useNow({ precision: 'minute' })
  const format = useFormat()
  return (
    <time dateTime={now} title={format.zoneName} className="tabular truncate text-xs text-ink-3">
      {format.formatWeekday(now)}, {format.formatDate(now)} · {format.formatTime(now)}{' '}
      {format.formatZoneLabel(now)}
    </time>
  )
}

/**
 * The 48 px top strip: dateline left; Search and the page's one primary action right. A drag region
 * whose interactive children are all `app-no-drag`. The strip shares the page's gutters so the
 * dateline, the title and the primary line up: the 64 px page column, or on the full-bleed Calendar
 * its own 40 px left and 24 px right (32 px beside the 288 px panel, where the primary meets the
 * panel text). It carries the page label as screen-reader text (one visible title per page lives in
 * the page's `h1`).
 */
export function TopBar(): React.JSX.Element {
  const pageId = useNavigation((state) => state.page)
  const params = useNavigation((state) => state.params)
  const page = getPage(pageId)
  const { ui } = useSettings()
  const openPalette = useCommandPalette((state) => state.setOpen)
  const collapsed = useShell((state) => state.sidebarCollapsed)
  const { isMac } = usePlatform()
  const host = usePageActionHost()

  const tab =
    params.tab === 'personal' || params.tab === 'conference' ? params.tab : ui.deadlinesTab
  const create = resolveCreateAction(page, tab)

  return (
    <header className="app-drag h-12 shrink-0">
      <div
        className={cn(
          'flex h-full items-center gap-4',
          pageId === 'calendar' ? 'w-full pr-6 pl-10 min-[1180px]:pr-8' : 'page-column'
        )}
        // Collapsed on macOS the traffic lights (x <= 68) overhang the 64 px rail: start content at x >= 128.
        style={isMac && collapsed ? { paddingLeft: 64 } : undefined}
      >
        <span className="sr-only">{page.label}</span>
        <Dateline />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="app-no-drag text-ink-2"
            // No aria-label: the name is the visible text ("Search" + the shortcut hint), so voice
            // control's "click Search" works (WCAG 2.5.3). The title says what it opens.
            title="Open command palette"
            aria-haspopup="dialog"
            onClick={() => openPalette(true)}
          >
            <Search aria-hidden="true" />
            Search
            <KeyboardHint shortcut="mod+K" />
          </Button>
          <div ref={host?.setSlot} className="app-no-drag flex items-center gap-2" />
          {create && !host?.count && (
            <Button
              size="sm"
              className="app-no-drag"
              aria-label={`${create.label} (${formatShortcutLabel('mod+N', isMac)})`}
              onClick={triggerQuickCreate}
            >
              {create.label}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
