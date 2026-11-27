import { Check, RefreshCw } from 'lucide-react'
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
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'
import { toastError } from '@renderer/lib/toast'
import { PassedToggle } from './PassedToggle'
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
      <DialogContent
        size="lg"
        className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>Add conference</DialogTitle>
          <DialogDescription className="sr-only">
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
      <div className="flex flex-col items-start gap-5">
        <p className="text-body max-w-sm text-ink-2">
          Load the CCF Deadlines list once; afterwards you only search it and pick conferences. The
          list refreshes itself in the background.
        </p>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Button onClick={() => void loadList('en')} disabled={add.isPending}>
            Load list (English)
          </Button>
          <button
            type="button"
            className="link app-no-drag"
            onClick={() => void loadList('zh')}
            disabled={add.isPending}
          >
            Load list (简体中文)
          </button>
        </div>
        <button type="button" className="link-quiet app-no-drag" onClick={onAdvanced}>
          Filtered feed or custom URL…
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Input
          autoFocus
          type="search"
          aria-label="Search conferences"
          placeholder="Search by name, e.g. NeurIPS, ICSE, SIGGRAPH…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1"
        />
        <PassedToggle
          checked={showPassed}
          onCheckedChange={setShowPassed}
          className="h-9 items-center"
        />
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
        <p className="text-body py-6 text-ink-3">Nothing matches “{search}”.</p>
      ) : (
        <ul
          className="-mx-1 flex min-h-0 flex-1 flex-col divide-y divide-line overflow-y-auto px-1"
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
                className="flex min-h-14 items-center gap-4 py-2"
                data-conference-id={item.id}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body truncate text-ink">{item.title}</span>
                  <span className="text-meta truncate text-ink-3">
                    {item.deadlineAt ? format.formatDate(item.deadlineAt) : 'TBD'}
                    {item.status === 'passed' ? ' · passed' : ''}
                    {subline ? ` · ${subline}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`${followed ? 'Remove' : 'Add'} ${item.title}`}
                  className={cn(
                    'app-no-drag inline-flex items-center gap-1.5 text-body disabled:opacity-50',
                    followed ? 'link-quiet' : 'link'
                  )}
                  onClick={() =>
                    followed ? unfollow.mutate({ id: item.id }) : follow.mutate({ id: item.id })
                  }
                >
                  {followed && <Check className="size-3.5" aria-hidden="true" />}
                  {followed ? 'Added' : 'Add'}
                </button>
              </li>
            )
          })}
          {results.length > MAX_RESULTS && (
            <li className="text-meta py-3 text-ink-3">
              {results.length - MAX_RESULTS} more — keep typing to narrow the list.
            </li>
          )}
        </ul>
      )}
      <div className="text-meta flex items-center justify-between gap-4 text-ink-3">
        <span className="flex items-center gap-1">
          {status.data?.lastSuccessAt
            ? `List updated ${format.formatRelative(status.data.lastSuccessAt, new Date().toISOString())}`
            : 'List not loaded yet'}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Refresh list"
            disabled={inProgress}
            onClick={() => refresh.mutate({ force: true })}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        </span>
        <button type="button" className="link-quiet app-no-drag" onClick={onAdvanced}>
          Filtered feed or custom URL…
        </button>
      </div>
    </div>
  )
}
