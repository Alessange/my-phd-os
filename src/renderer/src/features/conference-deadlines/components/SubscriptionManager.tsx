import { CircleAlert } from 'lucide-react'
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
  const [details, setDetails] = useState<string | undefined>()
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
    <div className={cn('flex flex-col gap-4', variant === 'compact' && 'gap-2')}>
      {list.length === 0 ? (
        <EmptyState
          variant="compact"
          title={EMPTY_STATES.conferenceDeadlinesNoSubscription.title}
          actions={[
            {
              label: EMPTY_STATES.conferenceDeadlinesNoSubscription.actions[0],
              onClick: () => setBuilder('official')
            }
          ]}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-meta text-ink-3">
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
            <div className="flex items-baseline gap-5 text-body">
              <button
                type="button"
                className="link-quiet disabled:no-underline disabled:opacity-50"
                onClick={() => refresh.mutate({ force: true })}
                disabled={inProgress || refresh.isPending}
              >
                Refresh now
              </button>
              <button type="button" className="link" onClick={() => setBuilder('official')}>
                Add subscription
              </button>
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
          <ul className="flex flex-col border-t border-line" aria-label="Conference subscriptions">
            {list.map((subscription) => {
              const spec = parseSubscriptionUrl(subscription.url)
              const filters = describeFilters(subscription.filters ?? spec?.filters)
              const language = subscription.language ?? spec?.language
              const state = status.data?.perSubscription[subscription.id]
              const isOpen = details === subscription.id
              return (
                <li
                  key={subscription.id}
                  className="flex flex-col gap-1 border-b border-line py-3"
                  data-subscription-id={subscription.id}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'truncate text-body',
                          subscription.enabled ? 'text-ink' : 'text-ink-3'
                        )}
                        title={subscription.label}
                      >
                        {subscription.label}
                      </div>
                      <div className="flex flex-wrap gap-x-2 text-meta text-ink-3">
                        {subscription.kind === 'custom' && <span>Custom</span>}
                        {language && <span>{language === 'zh' ? '简体中文' : 'English'}</span>}
                        {filters && <span>{filters}</span>}
                        {!subscription.enabled && <span>Paused</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 text-body">
                      <button
                        type="button"
                        className="link-quiet disabled:no-underline disabled:opacity-50"
                        aria-label={`Refresh ${subscription.label}`}
                        disabled={!subscription.enabled || state?.inProgress || refresh.isPending}
                        onClick={() =>
                          refresh.mutate({ subscriptionId: subscription.id, force: true })
                        }
                      >
                        {state?.inProgress ? 'Refreshing…' : 'Refresh'}
                      </button>
                      <button
                        type="button"
                        className="link-quiet"
                        aria-label={`Remove ${subscription.label}`}
                        onClick={() => setRemoving(subscription)}
                      >
                        Remove
                      </button>
                      <Switch
                        checked={subscription.enabled}
                        onCheckedChange={(enabled) =>
                          update.mutate({ id: subscription.id, patch: { enabled } })
                        }
                        aria-label={`Enable ${subscription.label}`}
                      />
                    </div>
                  </div>
                  <div className="tabular flex flex-wrap items-baseline gap-x-4 text-meta text-ink-3">
                    <span>
                      {subscription.lastSuccessAt
                        ? `Updated ${format.formatDateTime(subscription.lastSuccessAt)}`
                        : 'Never updated'}
                    </span>
                    {subscription.lastError && (
                      <span className="inline-flex items-center gap-1 text-signal">
                        <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                        <span>Error: {subscription.lastError.message}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      className="link-quiet"
                      aria-expanded={isOpen}
                      aria-controls={`subscription-details-${subscription.id}`}
                      aria-label={`Details of ${subscription.label}`}
                      onClick={() => setDetails(isOpen ? undefined : subscription.id)}
                    >
                      {isOpen ? 'Hide details' : 'Details'}
                    </button>
                  </div>
                  {isOpen && (
                    <dl
                      id={`subscription-details-${subscription.id}`}
                      className="tabular mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-meta text-ink-2"
                    >
                      <dt className="text-ink-3">Feed</dt>
                      <dd className="break-all">{subscription.url}</dd>
                      <dt className="text-ink-3">Last attempt</dt>
                      <dd>
                        {subscription.lastAttemptAt
                          ? format.formatDateTime(subscription.lastAttemptAt)
                          : 'never'}
                      </dd>
                      {subscription.etag && (
                        <>
                          <dt className="text-ink-3">ETag</dt>
                          <dd className="break-all">{subscription.etag}</dd>
                        </>
                      )}
                    </dl>
                  )}
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
