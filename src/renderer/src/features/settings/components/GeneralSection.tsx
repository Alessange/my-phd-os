import { useId, type ReactNode } from 'react'
import { TIMEZONE_OPTIONS } from '@shared/constants/timezones'
import { CALENDAR_VIEWS, type CalendarViewId } from '@shared/types/calendar'
import { DATE_FORMATS, type DateFormatId, type LaunchPage } from '@shared/types/settings'
import { ThemeToggle } from '@renderer/app/layout/ThemeToggle'
import { Label } from '@renderer/components/ui/label'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { useSettings } from '@renderer/hooks/useSettings'

const CALENDAR_VIEW_LABELS: Record<CalendarViewId, string> = {
  dayGridMonth: 'Month',
  timeGridWeek: 'Week',
  timeGridDay: 'Day',
  listWeek: 'Agenda'
}

const DATE_FORMAT_LABELS: Record<DateFormatId, string> = {
  system: 'System default',
  iso: 'ISO (2026-09-18)',
  dmy: 'Day first (18 Sep 2026)',
  mdy: 'Month first (Sep 18, 2026)'
}

export function SettingRow({
  label,
  description,
  htmlFor,
  children
}: {
  label: string
  description?: ReactNode
  htmlFor?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="grid gap-2 py-3 not-last:border-b sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-[13px]">
          {label}
        </Label>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex justify-start sm:justify-end">{children}</div>
    </div>
  )
}

/** Settings › General: every control is bound to `settings:update` through `useSettings` (optimistic). */
export function GeneralSection(): React.JSX.Element {
  const { settings, updateSettings } = useSettings()
  const now = useNow({ precision: 'minute' })
  const ids = { timezone: useId(), dateFormat: useId(), calendarView: useId() }
  const preview = useFormat()
  const knownTimezone = TIMEZONE_OPTIONS.some((group) =>
    group.options.some((o) => o.id === settings.timezone)
  )

  return (
    <div className="flex flex-col">
      <SettingRow
        label="Application timezone"
        htmlFor={ids.timezone}
        description={
          <>
            Times are displayed in this zone. Now: {preview.formatClock(now)}{' '}
            {preview.formatZoneLabel(now)}
          </>
        }
      >
        <Select
          value={settings.timezone}
          onValueChange={(timezone) => void updateSettings({ timezone })}
        >
          <SelectTrigger id={ids.timezone} className="w-72" aria-label="Application timezone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!knownTimezone && (
              <SelectGroup>
                <SelectLabel>Current</SelectLabel>
                <SelectItem value={settings.timezone}>{settings.timezone}</SelectItem>
              </SelectGroup>
            )}
            {TIMEZONE_OPTIONS.map((group) => (
              <SelectGroup key={group.group}>
                <SelectLabel>{group.group}</SelectLabel>
                {group.options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow
        label="Date format"
        htmlFor={ids.dateFormat}
        description={<>Today: {preview.formatDate(now)}</>}
      >
        <Select
          value={settings.dateFormat}
          onValueChange={(dateFormat) =>
            void updateSettings({ dateFormat: dateFormat as DateFormatId })
          }
        >
          <SelectTrigger id={ids.dateFormat} className="w-60" aria-label="Date format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMATS.map((format) => (
              <SelectItem key={format} value={format}>
                {DATE_FORMAT_LABELS[format]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="Week starts on">
        <SegmentedControl
          aria-label="Week starts on"
          value={String(settings.weekStartsOn) as '0' | '1'}
          onValueChange={(value) => void updateSettings({ weekStartsOn: value === '1' ? 1 : 0 })}
          options={[
            { value: '1', label: 'Monday' },
            { value: '0', label: 'Sunday' }
          ]}
        />
      </SettingRow>

      <SettingRow label="Clock" description={<>Now: {preview.formatTime(now)}</>}>
        <SegmentedControl
          aria-label="Clock"
          value={settings.clock}
          onValueChange={(clock) => void updateSettings({ clock })}
          options={[
            { value: '24h', label: '24-hour' },
            { value: '12h', label: '12-hour' }
          ]}
        />
      </SettingRow>

      <SettingRow label="Theme" description="System follows your operating system's appearance.">
        <ThemeToggle />
      </SettingRow>

      <SettingRow
        label="Default calendar view"
        htmlFor={ids.calendarView}
        description="Used when the Calendar opens without a remembered view."
      >
        <Select
          value={settings.defaultCalendarView}
          onValueChange={(view) =>
            void updateSettings({ defaultCalendarView: view as CalendarViewId })
          }
        >
          <SelectTrigger id={ids.calendarView} className="w-40" aria-label="Default calendar view">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALENDAR_VIEWS.map((view) => (
              <SelectItem key={view} value={view}>
                {CALENDAR_VIEW_LABELS[view]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow
        label="On launch, open"
        description="Calendar is always the default on a fresh install."
      >
        <SegmentedControl
          aria-label="On launch, open"
          value={settings.launchPage}
          onValueChange={(launchPage: LaunchPage) => void updateSettings({ launchPage })}
          options={[
            { value: 'last', label: 'Last visited page' },
            { value: 'calendar', label: 'Calendar' }
          ]}
        />
      </SettingRow>
    </div>
  )
}
