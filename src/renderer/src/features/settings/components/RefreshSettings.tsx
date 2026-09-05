import { useId } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { useSettings } from '@renderer/hooks/useSettings'
import { SettingRow } from './GeneralSection'

const INTERVAL_OPTIONS = [1, 3, 6, 12, 24, 72, 168] as const

const intervalLabel = (hours: number): string =>
  hours < 24
    ? `Every ${hours} hour${hours === 1 ? '' : 's'}`
    : `Every ${hours / 24} day${hours === 24 ? '' : 's'}`

/** Automatic refresh preferences for conference subscriptions (spec §17 › Conference Subscriptions). */
export function RefreshSettings(): React.JSX.Element {
  const { settings, updateSettings } = useSettings()
  const ids = { interval: useId(), onLaunch: useId(), timeout: useId() }
  const intervals = INTERVAL_OPTIONS.includes(
    settings.subscriptionRefreshIntervalHours as (typeof INTERVAL_OPTIONS)[number]
  )
    ? [...INTERVAL_OPTIONS]
    : [...INTERVAL_OPTIONS, settings.subscriptionRefreshIntervalHours].sort((a, b) => a - b)

  return (
    <div className="flex flex-col">
      <SettingRow
        label="Automatic refresh"
        htmlFor={ids.interval}
        description="Subscriptions are re-fetched in the background when the cached snapshot is older than this."
      >
        <Select
          value={String(settings.subscriptionRefreshIntervalHours)}
          onValueChange={(value) =>
            void updateSettings({ subscriptionRefreshIntervalHours: Number(value) })
          }
        >
          <SelectTrigger id={ids.interval} className="w-44" aria-label="Automatic refresh interval">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {intervals.map((hours) => (
              <SelectItem key={hours} value={String(hours)}>
                {intervalLabel(hours)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow
        label="Refresh on launch"
        htmlFor={ids.onLaunch}
        description="Check for updates when the app starts, if the cache is stale."
      >
        <Switch
          id={ids.onLaunch}
          checked={settings.refreshOnLaunch}
          onCheckedChange={(refreshOnLaunch) => void updateSettings({ refreshOnLaunch })}
        />
      </SettingRow>
      <SettingRow
        label="Request timeout"
        htmlFor={ids.timeout}
        description="Give up on a slow feed after this long; the last good snapshot is kept."
      >
        <Select
          value={String(settings.requestTimeoutMs)}
          onValueChange={(value) => void updateSettings({ requestTimeoutMs: Number(value) })}
        >
          <SelectTrigger id={ids.timeout} className="w-36" aria-label="Request timeout">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10_000, 20_000, 30_000, 60_000].map((ms) => (
              <SelectItem key={ms} value={String(ms)}>
                {ms / 1000} seconds
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </div>
  )
}
