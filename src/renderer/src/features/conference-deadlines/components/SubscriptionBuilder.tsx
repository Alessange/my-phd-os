import { Check, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import {
  CCF_RANK_OPTIONS,
  CCF_SUBJECTS,
  CORE_RANK_OPTIONS,
  SUBSCRIPTION_LANGUAGE_LABELS,
  THCPL_RANK_OPTIONS
} from '@shared/constants/ccf'
import { APPROVED_SUBSCRIPTION_HOSTS, isApprovedSubscriptionUrl } from '@shared/constants/hosts'
import {
  buildSubscriptionFileName,
  buildSubscriptionUrl
} from '@shared/conferences/buildSubscriptionUrl'
import { AppError } from '@shared/errors'
import type { SubscriptionFilters, SubscriptionLanguage } from '@shared/types/conference'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { useAddSubscription, useRefreshNow } from '../api'

const ANY = 'any'
export type BuilderMode = 'official' | 'custom'

export interface SubscriptionBuilderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which panel opens first: the visual builder or the custom URL form. */
  initialMode?: BuilderMode
}

const isHttps = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Visual subscription builder (spec §12.1): language, CCF / CORE / TH-CPL ranks and subject compose
 * the official filename (`A*` → `Astar`, fixed filter order) with a live URL preview; a custom URL
 * needs an explicit trust confirmation before it is ever fetched. A new subscription is refreshed
 * right away.
 */
export function SubscriptionBuilder({
  open,
  onOpenChange,
  initialMode = 'official'
}: SubscriptionBuilderProps): React.JSX.Element {
  const add = useAddSubscription()
  const refresh = useRefreshNow()
  const [mode, setMode] = useState<BuilderMode>(initialMode)
  const [language, setLanguage] = useState<SubscriptionLanguage>('en')
  const [filters, setFilters] = useState<SubscriptionFilters>({})
  const [label, setLabel] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [trusted, setTrusted] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevMode, setPrevMode] = useState(initialMode)
  if (open !== prevOpen || initialMode !== prevMode) {
    setPrevOpen(open)
    setPrevMode(initialMode)
    if (open) {
      setMode(initialMode)
      setLanguage('en')
      setFilters({})
      setLabel('')
      setCustomUrl('')
      setTrusted(false)
    }
  }

  const officialUrl = buildSubscriptionUrl({ language, filters })
  const url = mode === 'official' ? officialUrl : customUrl.trim()
  const approved = isApprovedSubscriptionUrl(url)
  const urlValid = mode === 'official' || isHttps(url)
  const canAdd = urlValid && (approved || trusted) && !add.isPending

  const submit = async (): Promise<void> => {
    if (!canAdd) return
    try {
      const subscription = await add.mutateAsync({
        url,
        kind: approved ? 'official' : 'custom',
        language: mode === 'official' ? language : undefined,
        filters: mode === 'official' ? filters : undefined,
        label: label.trim() || undefined,
        confirmCustom: approved ? undefined : trusted
      })
      toastSuccess('Subscription added', 'Fetching the feed now…')
      onOpenChange(false)
      refresh.mutate({ subscriptionId: subscription.id })
    } catch (error) {
      if (error instanceof AppError && error.code === 'CONFLICT') {
        toastError(error, { title: 'Already subscribed' })
      } else {
        toastError(error, { retry: submit })
      }
    }
  }

  const setFilter = <K extends keyof SubscriptionFilters>(key: K, value: string): void =>
    setFilters((f) => ({
      ...f,
      [key]: value === ANY ? undefined : (value as SubscriptionFilters[K])
    }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add conference subscription</DialogTitle>
          <DialogDescription>
            Deadlines come from the CCF Deadlines .ics feeds, fetched by the app itself. Nothing
            personal is ever sent.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <SegmentedControl
            aria-label="Subscription type"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: 'official', label: 'CCF Deadlines (official)' },
              { value: 'custom', label: 'Custom URL' }
            ]}
          />

          {mode === 'official' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Language</Label>
                <SegmentedControl
                  aria-label="Feed language"
                  size="sm"
                  value={language}
                  onValueChange={setLanguage}
                  options={(
                    Object.keys(SUBSCRIPTION_LANGUAGE_LABELS) as SubscriptionLanguage[]
                  ).map((code) => ({
                    value: code,
                    label: SUBSCRIPTION_LANGUAGE_LABELS[code]
                  }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="builder-ccf">CCF rank</Label>
                  <Select value={filters.ccf ?? ANY} onValueChange={(v) => setFilter('ccf', v)}>
                    <SelectTrigger id="builder-ccf" aria-label="CCF rank">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any CCF rank</SelectItem>
                      {CCF_RANK_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          CCF {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="builder-core">CORE rank</Label>
                  <Select value={filters.core ?? ANY} onValueChange={(v) => setFilter('core', v)}>
                    <SelectTrigger id="builder-core" aria-label="CORE rank">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any CORE rank</SelectItem>
                      {CORE_RANK_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          CORE {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="builder-thcpl">TH-CPL rank</Label>
                  <Select value={filters.thcpl ?? ANY} onValueChange={(v) => setFilter('thcpl', v)}>
                    <SelectTrigger id="builder-thcpl" aria-label="TH-CPL rank">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any TH-CPL rank</SelectItem>
                      {THCPL_RANK_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          TH-CPL {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="builder-subject">Subject</Label>
                  <Select
                    value={filters.subject ?? ANY}
                    onValueChange={(v) => setFilter('subject', v)}
                  >
                    <SelectTrigger id="builder-subject" aria-label="Subject">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>All subjects</SelectItem>
                      {CCF_SUBJECTS.map((subject) => (
                        <SelectItem key={subject.code} value={subject.code}>
                          {subject.code} · {language === 'zh' ? subject.name_zh : subject.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Generated URL</Label>
                <code
                  className="block truncate rounded-md border bg-muted/60 px-3 py-2 text-xs"
                  data-testid="builder-url"
                  title={officialUrl}
                >
                  {officialUrl}
                </code>
                <p className="text-[11px] text-muted-foreground">
                  File:{' '}
                  <span className="font-mono">
                    {buildSubscriptionFileName({ language, filters })}
                  </span>{' '}
                  · filters follow the official order CCF, CORE, TH-CPL, subject; A* is written
                  Astar.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="builder-custom-url">Subscription URL</Label>
                <Input
                  id="builder-custom-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://…/deadlines.ics"
                  value={customUrl}
                  onChange={(e) => {
                    setCustomUrl(e.target.value)
                    setTrusted(false)
                  }}
                  aria-invalid={customUrl.length > 0 && !urlValid}
                />
                {customUrl.length > 0 && !urlValid && (
                  <p className="text-xs text-destructive">Enter an https URL.</p>
                )}
              </div>
              {urlValid && !approved && (
                <div
                  className="flex flex-col gap-2 rounded-md border border-status-at-risk/40 bg-status-at-risk/6 p-3 text-xs"
                  role="alert"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <ShieldAlert className="size-4 text-status-at-risk" aria-hidden="true" />
                    Not an official CCF Deadlines source
                  </div>
                  <p className="text-muted-foreground">
                    Official feeds come from {APPROVED_SUBSCRIPTION_HOSTS.join(', ')}. This URL will
                    be fetched from its own host and its .ics parsed like the official feed. Only
                    add sources you trust.
                  </p>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={trusted}
                      onCheckedChange={(checked) => setTrusted(checked === true)}
                      aria-label="I trust this source"
                    />
                    I trust this source and want to fetch it
                  </label>
                </div>
              )}
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="builder-label">Label (optional)</Label>
            <Input
              id="builder-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Defaults to the file name"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canAdd}>
            <Check aria-hidden="true" />
            Add subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
