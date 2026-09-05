import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { THEMES, type ThemeId } from '@shared/types/settings'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useSettings } from '@renderer/hooks/useSettings'

const THEME_OPTIONS: { value: ThemeId; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor }
]

export interface ThemeToggleProps {
  /** Icon-only dropdown for the collapsed sidebar. */
  compact?: boolean
  /** Show icons only in the segmented control (labels stay as accessible names). */
  iconsOnly?: boolean
  className?: string
}

/** Light / Dark / System control persisted through `settings:update`. */
export function ThemeToggle({
  compact = false,
  iconsOnly = false,
  className
}: ThemeToggleProps): React.JSX.Element {
  const { settings, updateSettings } = useSettings()
  const current =
    THEME_OPTIONS.find((option) => option.value === settings.theme) ?? THEME_OPTIONS[2]
  const setTheme = (value: string): void => {
    if ((THEMES as readonly string[]).includes(value))
      void updateSettings({ theme: value as ThemeId })
  }

  if (compact) {
    const Icon = current.icon
    return (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Theme: ${current.label}. Change theme`}
                className={className}
              >
                <Icon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Theme: {current.label}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="right" align="end" className="min-w-36">
          <DropdownMenuRadioGroup value={settings.theme} onValueChange={setTheme}>
            {THEME_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <option.icon aria-hidden="true" />
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <SegmentedControl
      aria-label="Theme"
      size="sm"
      className={className}
      value={settings.theme}
      onValueChange={setTheme}
      options={THEME_OPTIONS.map((option) => ({
        value: option.value,
        label: iconsOnly ? null : option.label,
        ariaLabel: option.label,
        icon: <option.icon aria-hidden="true" />
      }))}
    />
  )
}
