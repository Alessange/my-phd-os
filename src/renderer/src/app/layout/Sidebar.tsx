import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { PAGES, useNavigation } from '@renderer/app/navigation'
import { useShell } from '@renderer/app/shell'
import { KeyboardHint } from '@renderer/components/common/KeyboardHint'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { usePlatform } from '@renderer/hooks/usePlatform'
import { formatShortcutLabel } from '@renderer/lib/shortcutLabel'
import { cn } from '@renderer/lib/utils'
import { ThemeToggle } from './ThemeToggle'

/**
 * The quiet list: five items on the paper ground, 216 px wide (76 collapsed), a hairline on the
 * right and nothing else. No brand tile, no wordmark, no coloured icon.
 *
 * Contract (e2e): `nav[aria-label="Primary"]` holds exactly five buttons in page order, the label is
 * the FIRST `<span>` of each button, the active one has `aria-current="page"`.
 *
 * macOS: the native traffic lights occupy x 16-68, y 18-30, so the top 48 px of the rail is an empty
 * drag region. The collapsed rail is 76 px, wider than the lights (68 px) plus a margin, so they never
 * touch its hairline.
 */
export function Sidebar(): React.JSX.Element {
  const page = useNavigation((state) => state.page)
  const navigate = useNavigation((state) => state.navigate)
  const collapsed = useShell((state) => state.sidebarCollapsed)
  const toggleSidebar = useShell((state) => state.toggleSidebar)
  const { isMac } = usePlatform()

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'flex h-full shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground',
        collapsed ? 'w-[76px]' : 'w-[216px]'
      )}
    >
      <div aria-hidden="true" className="app-drag h-12 shrink-0" />

      <nav aria-label="Primary" className={cn('flex-1 pt-4', collapsed ? 'px-0' : 'pr-3')}>
        <ul className="flex flex-col gap-0.5">
          {PAGES.map((entry) => {
            const active = entry.id === page
            const shortcut = `mod+${entry.shortcutIndex}`
            const button = (
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={collapsed ? entry.label : undefined}
                onClick={() => navigate(entry.id)}
                className={cn(
                  // Inset focus ring: the item sits flush with the window edge, so an outside ring would be clipped on the left.
                  'group relative flex h-9 w-full items-center gap-3 rounded-r-sm text-sm transition-colors duration-100 focus-visible:outline-offset-[-2px]',
                  collapsed ? 'justify-center' : 'pr-3 pl-7',
                  active
                    ? 'bg-wash text-ink before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-ink'
                    : 'text-ink-2 hover:bg-hover hover:text-ink'
                )}
              >
                <entry.icon
                  aria-hidden="true"
                  className={cn('size-4 shrink-0', active ? 'text-ink' : 'text-ink-3')}
                />
                {!collapsed && (
                  <>
                    <span className="truncate">{entry.label}</span>
                    <KeyboardHint
                      shortcut={shortcut}
                      className="ml-auto opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  </>
                )}
              </button>
            )
            return (
              <li key={entry.id}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">
                      {entry.label}
                      <span className="ml-2 text-ink-3">
                        {formatShortcutLabel(shortcut, isMac)}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div
        className={cn(
          'flex shrink-0 gap-1 pb-4',
          collapsed ? 'flex-col items-center' : 'flex-row items-center pl-5'
        )}
      >
        <ThemeToggle variant="menu" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              onClick={toggleSidebar}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" />
              ) : (
                <PanelLeftClose aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
