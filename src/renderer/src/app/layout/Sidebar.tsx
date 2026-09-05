import { GraduationCap, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { PAGES, useNavigation } from '@renderer/app/navigation'
import { useShell } from '@renderer/app/shell'
import { KeyboardHint } from '@renderer/components/common/KeyboardHint'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { usePlatform } from '@renderer/hooks/usePlatform'
import { formatShortcutLabel } from '@renderer/lib/shortcutLabel'
import { cn } from '@renderer/lib/utils'
import { ThemeToggle } from './ThemeToggle'

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
        'flex h-full shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Brand row doubles as the window drag region; on macOS it leaves room for the traffic lights. */}
      <div
        className={cn(
          'app-drag flex shrink-0 items-center gap-2 px-3',
          isMac ? 'h-13 pt-3' : 'h-12',
          collapsed && 'justify-center px-0'
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs"
        >
          <GraduationCap className="size-4" />
        </span>
        {!collapsed && (
          <span className="truncate text-[13px] font-semibold tracking-tight">My PhD OS</span>
        )}
      </div>

      <nav aria-label="Primary" className="flex-1 px-2 pt-1">
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
                  'group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors outline-none',
                  'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'bg-card text-foreground shadow-xs' : 'text-sidebar-foreground/85',
                  collapsed && 'justify-center px-0'
                )}
              >
                <entry.icon
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0',
                    active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="truncate">{entry.label}</span>
                    <KeyboardHint
                      shortcut={shortcut}
                      className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
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
                      <span className="ml-2 opacity-70">
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

      <div className={cn('flex flex-col gap-2 p-2', collapsed ? 'items-center' : 'items-stretch')}>
        <ThemeToggle
          compact={collapsed}
          iconsOnly
          className={collapsed ? undefined : 'w-full [&>button]:flex-1'}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              onClick={toggleSidebar}
              className={cn(!collapsed && 'justify-start text-muted-foreground')}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" />
              ) : (
                <PanelLeftClose aria-hidden="true" />
              )}
              {!collapsed && 'Collapse'}
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
