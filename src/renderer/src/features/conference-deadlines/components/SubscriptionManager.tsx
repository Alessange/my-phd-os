import { Plus, RefreshCw, Rss, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { describeFilters, parseSubscriptionUrl } from '@shared/conferences/buildSubscriptionUrl'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import type { ConferenceSubscription } from '@shared/types/conference'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'
import {
  useRefreshNow,
  useRefreshStatus,
  useRemoveSubscription,
  useSubscriptions,
  useUpdateSubscription
} from '../api'
import { SubscriptionBuilder, type BuilderMode } from './SubscriptionBuilder'

export interface SubscriptionManagerProps {
  /** Compact layout for the Deadlines empty state; the Settings section uses the default. */
  variant?: 'default' | 'compact'
}

/**
 * Subscription list + refresh controls (spec §12.1, §12.2, §17): enable/disable, remove, refresh
 * one or all, last successful and last attempted refresh, last error, cached-snapshot notice.
 * Used by Settings › Conference Subscriptions and by the Deadlines tab.
 */
export function SubscriptionManager({
  variant = 'default'
}: SubscriptionManagerProps): React.JSX.Element {
  const format = useFormat()
  const subscriptions = useSubscriptions()
  const status = useRefreshStatus()
  const refresh = useRefreshNow()
  const update = useUpdateSubscription()
  const remove = useRemoveSubscription()
  const [builder, setBuilder] = useState<BuilderMode | undefined>()
  const [removing, setRemoving] = useState<ConferenceSubscription | undefined>()

  const list = subscriptions.data ?? []
  const inProgress = status.data?.inProgress ?? false

  if (subscriptions.isPending)
    return <LoadingState variant="inline" label="Loading subscriptions…" />
  if (subscriptions.isError)
    return (
      <ErrorState
        variant="compact"
        error={subscriptions.error}
        title="Could not load subscriptions"
        onRetry={() => void subscriptions.refetch()}
      />
    )

  return (
    <div className={cn('flex flex-col gap-3', variant === 'compact' && 'gap-2')}>
      {list.length === 0 ? (
        <EmptyState
          variant="compact"
          icon={Rss}
          title={EMPTY_STATES.conferenceDeadlinesNoSubscription.title}
          actions={[
            {
              label: EMPTY_STATES.conferenceDeadlinesNoSubscription.actions[0],
              onClick: () => setBuilder('official'),
              variant: 'outline'
            }
          ]}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="tabular" data-testid="refresh-summary">
              {inProgress ? (
                <LoadingState variant="inline" label="Refreshing…" />
              ) : status.data?.lastSuccessAt ? (
                `Last refreshed ${format.formatDateTime(status.data.lastSuccessAt)}`
              ) : (
                'Never refreshed yet'
              )}
              {status.data?.nextAutoRefreshAt && !inProgress
                ? ` · next automatic check ${format.formatRelative(status.data.nextAutoRefreshAt, new Date().toISOString())}`
                : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refresh.mutate({ force: true })}
                disabled={inProgress || refresh.isPending}
              >
                <RefreshCw aria-hidden="true" className={inProgress ? 'animate-spin' : undefined} />
                Refresh now
              </Button>
              <Button size="sm" onClick={() => setBuilder('official')}>
                <Plus aria-hidden="true" />
                Add subscription
              </Button>
            </div>
          </div>
          {status.data?.lastError && !inProgress && (
            <ErrorState
              variant="compact"
              title="The last refresh failed; cached data is shown"
              message={`${status.data.lastError.message} (${format.formatDateTime(status.data.lastError.at)})`}
              onRetry={() => refresh.mutate({ force: true })}
            />
          )}
          <ul className="flex flex-col gap-2" aria-label="Conference subscriptions">
            {list.map((subscription) => {
              const spec = parseSubscriptionUrl(subscription.url)
              const filters = describeFilters(subscription.filters ?? spec?.filters)
              const state = status.data?.perSubscription[subscription.id]
              return (
                <li
                  key={subscription.id}
                  className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-xs"
                  data-subscription-id={subscription.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant={subscription.kind === 'official' ? 'secondary' : 'outline'}>
                        {subscription.kind === 'official' ? 'CCF Deadlines' : 'Custom'}
                      </Badge>
                      <span
                        className={cn(
                          'truncate text-sm font-medium',
                          !subscription.enabled && 'text-muted-foreground line-through'
                        )}
                      >
                        {subscription.label}
                      </span>
                      {(subscription.language ?? spec?.language) && (
                        <Badge variant="outline">
                          {(subscription.language ?? spec?.language) === 'zh'
                            ? '简体中文'
                            : 'English'}
                        </Badge>
                      )}
                      {filters && <Badge variant="outline">{filters}</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Switch
                          checked={subscription.enabled}
                          onCheckedChange={(enabled) =>
                            update.mutate({ id: subscription.id, patch: { enabled } })
                          }
                          aria-label={`Enable ${subscription.label}`}
                        />
                        {subscription.enabled ? 'Enabled' : 'Disabled'}
                      </label>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Refresh ${subscription.label}`}
                        disabled={!subscription.enabled || state?.inProgress || refresh.isPending}
                        onClick={() =>
                          refresh.mutate({ subscriptionId: subscription.id, force: true })
                        }
                      >
                        <RefreshCw
                          aria-hidden="true"
                          className={state?.inProgress ? 'animate-spin' : undefined}
                        />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Remove ${subscription.label}`}
                        onClick={() => setRemoving(subscription)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <code
                    className="truncate text-[11px] text-muted-foreground"
                    title={subscription.url}
                  >
                    {subscription.url}
                  </code>
                  <div className="tabular flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span>
                      Last success:{' '}
                      {subscription.lastSuccessAt
                        ? format.formatDateTime(subscription.lastSuccessAt)
                        : 'never'}
                    </span>
                    <span>
                      Last attempt:{' '}
                      {subscription.lastAttemptAt
                        ? format.formatDateTime(subscription.lastAttemptAt)
                        : 'never'}
                    </span>
                    {subscription.etag && <span>ETag {subscription.etag}</span>}
                    {subscription.lastError && (
                      <span className="text-status-at-risk">
                        Error: {subscription.lastError.message}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <SubscriptionBuilder
        open={builder !== undefined}
        onOpenChange={(open) => !open && setBuilder(undefined)}
        initialMode={builder ?? 'official'}
      />

      <AlertDialog
        open={removing !== undefined}
        onOpenChange={(open) => !open && setRemoving(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{removing?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The subscription, its cached snapshot, every conference deadline it provided, your
              follows on them and their change history are removed from this computer. Calendar
              events created from those deadlines lose their link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (removing)
                  remove.mutate({ id: removing.id }, { onSuccess: () => setRemoving(undefined) })
              }}
            >
              Remove subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
