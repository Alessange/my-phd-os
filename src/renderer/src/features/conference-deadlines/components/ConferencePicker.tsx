import { Check, Plus, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  conferenceSubline,
  matchesSearch,
  sortConferenceDeadlines
} from '@shared/conferences/views'
import { OFFICIAL_FEED_URLS } from '@shared/constants/hosts'
import type { SubscriptionLanguage } from '@shared/types/conference'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { useFormat } from '@renderer/hooks/useFormat'
import { toastError } from '@renderer/lib/toast'
import {
  useAddSubscription,
  useConferenceDeadlines,
  useFollow,
  useRefreshNow,
  useRefreshStatus,
  useSubscriptions,
  useUnfollow
} from '../api'

const MAX_RESULTS = 40

export interface ConferencePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opens the advanced subscription form (filtered feed / custom URL). */
  onAdvanced: () => void
}

/**
 * "Add conference": search the cached CCF Deadlines list and tick the few you care about. If no
 * list has been loaded yet, one click subscribes to the official feed (English or 简体中文) and
 * fetches it. The feed is a lookup source; only what you add here reaches the board.
 */
export function ConferencePicker({
  open,
  onOpenChange,
  onAdvanced
}: ConferencePickerProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add conference</DialogTitle>
          <DialogDescription>
            Search the CCF Deadlines list and add the conferences you care about.
          </DialogDescription>
        </DialogHeader>
        {open && <PickerBody onAdvanced={onAdvanced} />}
      </DialogContent>
    </Dialog>
  )
}

function PickerBody({ onAdvanced }: { onAdvanced: () => void }): React.JSX.Element {
  const format = useFormat()
  const subscriptions = useSubscriptions()
  const deadlines = useConferenceDeadlines()
  const status = useRefreshStatus()
  const add = useAddSubscription()
  const refresh = useRefreshNow()
  const follow = useFollow()
  const unfollow = useUnfollow()
  const [search, setSearch] = useState('')
  const [showPassed, setShowPassed] = useState(false)

  const all = useMemo(() => deadlines.data ?? [], [deadlines.data])
  const results = useMemo(() => {
    const filtered = all.filter(
      (item) => (showPassed || item.status !== 'passed') && matchesSearch(item, search)
    )
    return sortConferenceDeadlines(filtered, 'nearest')
  }, [all, search, showPassed])
  const inProgress = status.data?.inProgress ?? refresh.isPending

  const loadList = async (language: SubscriptionLanguage): Promise<void> => {
    try {
      const subscription = await add.mutateAsync({
        url: OFFICIAL_FEED_URLS[language],
        kind: 'official',
        language,
        filters: {}
      })
      refresh.mutate({ subscriptionId: subscription.id })
    } catch (error) {
      toastError(error, { retry: () => loadList(language) })
    }
  }

  if (subscriptions.isPending || deadlines.isPending) return <LoadingState label="Loading…" />
  if (subscriptions.isError)
    return (
      <ErrorState
        error={subscriptions.error}
        title="Could not load sources"
        onRetry={() => void subscriptions.refetch()}
      />
    )

  if ((subscriptions.data ?? []).length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Load the CCF Deadlines list once; afterwards you only search it and pick conferences. The
          list refreshes itself in the background.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => void loadList('en')} disabled={add.isPending}>
            <Plus aria-hidden="true" />
            Load list (English)
          </Button>
          <Button variant="outline" onClick={() => void loadList('zh')} disabled={add.isPending}>
            Load list (简体中文)
          </Button>
        </div>
        <Button variant="link" size="sm" onClick={onAdvanced}>
          Filtered feed or custom URL…
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            autoFocus
            type="search"
            aria-label="Search conferences"
            placeholder="Search by name, e.g. NeurIPS, ICSE, SIGGRAPH…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Switch checked={showPassed} onCheckedChange={setShowPassed} aria-label="Show passed" />
          Show passed
        </label>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Refresh list"
          disabled={inProgress}
          onClick={() => refresh.mutate({ force: true })}
        >
          <RefreshCw aria-hidden="true" className={inProgress ? 'animate-spin' : undefined} />
        </Button>
      </div>

      {deadlines.isError ? (
        <ErrorState
          variant="compact"
          error={deadlines.error}
          title="Could not load the list"
          onRetry={() => void deadlines.refetch()}
        />
      ) : all.length === 0 ? (
        inProgress ? (
          <LoadingState label="Fetching the CCF Deadlines list…" />
        ) : (
          <ErrorState
            variant="compact"
            title="The list has not loaded yet"
            message={status.data?.lastError?.message ?? 'No snapshot has been retrieved.'}
            onRetry={() => refresh.mutate({ force: true })}
          />
        )
      ) : results.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing matches “{search}”.
        </p>
      ) : (
        <ul
          className="-mx-1 flex max-h-[50vh] flex-col overflow-y-auto px-1"
          aria-label="Search results"
        >
          {results.slice(0, MAX_RESULTS).map((item) => {
            const followed = item.followed !== undefined
            const busy =
              (follow.isPending && follow.variables?.id === item.id) ||
              (unfollow.isPending && unfollow.variables?.id === item.id)
            const subline = conferenceSubline(item)
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b py-2 last:border-b-0"
                data-conference-id={item.id}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {item.deadlineAt ? format.formatDate(item.deadlineAt) : 'TBD'}
                    {item.status === 'passed' ? ' · passed' : ''}
                    {subline ? ` · ${subline}` : ''}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={followed ? 'outline' : 'default'}
                  disabled={busy}
                  aria-label={`${followed ? 'Remove' : 'Add'} ${item.title}`}
                  onClick={() =>
                    followed ? unfollow.mutate({ id: item.id }) : follow.mutate({ id: item.id })
                  }
                >
                  {followed ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {followed ? 'Added' : 'Add'}
                </Button>
              </li>
            )
          })}
          {results.length > MAX_RESULTS && (
            <li className="py-2 text-center text-[11px] text-muted-foreground">
              {results.length - MAX_RESULTS} more — keep typing to narrow the list.
            </li>
          )}
        </ul>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {status.data?.lastSuccessAt
            ? `List updated ${format.formatRelative(status.data.lastSuccessAt, new Date().toISOString())}`
            : 'List not loaded yet'}
        </span>
        <Button variant="link" size="sm" className="h-auto p-0 text-[11px]" onClick={onAdvanced}>
          Filtered feed or custom URL…
        </Button>
      </div>
    </div>
  )
}
