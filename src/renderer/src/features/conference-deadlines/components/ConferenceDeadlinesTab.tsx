import { CircleAlert } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { sortConferenceDeadlines, updatedDeadlineIds } from '@shared/conferences/views'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import { useCommandListener } from '@renderer/app/commandBus'
import { CREATE_LABELS, useNavigation } from '@renderer/app/navigation'
import { DEADLINES_QUICK_CREATE } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { PageAction } from '@renderer/components/common/PageAction'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { Button } from '@renderer/components/ui/button'
import { Section } from '@renderer/components/ui/section'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import {
  useAcknowledgeChanges,
  useConferenceChanges,
  useConferenceDeadline,
  useFollowedConferences,
  useRefreshNow,
  useRefreshStatus,
  useSubscriptions
} from '../api'
import { ConferenceBoard } from './ConferenceBoard'
import { ConferenceChangesBanner } from './ConferenceChangesBanner'
import { ConferencePicker } from './ConferencePicker'
import { PassedToggle } from './PassedToggle'
import { ConferenceSheet } from './ConferenceSheet'
import { SubscriptionBuilder, type BuilderMode } from './SubscriptionBuilder'

const NO_ITEMS: ConferenceDeadlineView[] = []

/**
 * Conference Deadlines tab, kept deliberately small: the conferences you chose as hairline rows,
 * the first with the one big countdown, plus "Add conference" (search the CCF Deadlines list) and a
 * one-line feed status. Details live in a sheet. Quick-create and `{ create }` open the picker; `{ id }` opens the sheet.
 */
export function ConferenceDeadlinesTab(): React.JSX.Element {
  const format = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const params = useNavigation((state) => state.params)
  const navigate = useNavigation((state) => state.navigate)

  const subscriptions = useSubscriptions()
  const followed = useFollowedConferences()
  const status = useRefreshStatus()
  const changes = useConferenceChanges({ unacknowledgedOnly: true, followedOnly: true })
  const refresh = useRefreshNow()
  const acknowledge = useAcknowledgeChanges()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [builder, setBuilder] = useState<BuilderMode | undefined>()
  const [detailsId, setDetailsId] = useState<string | undefined>()
  const [showPassed, setShowPassed] = useState(false)

  const openPicker = useCallback(() => setPickerOpen(true), [])
  useCommandListener(DEADLINES_QUICK_CREATE.conference, openPicker)

  // Deep links, derived during render; each tracks the param's current value (Decision 54).
  const [lastCreate, setLastCreate] = useState<string | undefined>()
  if (params.create !== lastCreate) {
    setLastCreate(params.create)
    if (params.create !== undefined) setPickerOpen(true)
  }
  const [lastId, setLastId] = useState<string | undefined>()
  if (params.id !== lastId) {
    setLastId(params.id)
    setDetailsId(params.id)
  }
  const clearDeepLink = (): void => {
    if (params.create !== undefined || params.id !== undefined)
      navigate('deadlines', { tab: 'conference' })
  }

  const items = followed.data ?? NO_ITEMS
  const sorted = useMemo(() => sortConferenceDeadlines(items, 'nearest'), [items])
  const passedCount = sorted.filter((i) => i.status === 'passed').length
  const visible = showPassed ? sorted : sorted.filter((i) => i.status !== 'passed')
  const updatedIds = useMemo(() => updatedDeadlineIds(changes.data ?? []), [changes.data])
  const nextItem = visible.find((i) => i.status === 'upcoming' && i.deadlineAt)
  const inProgress = status.data?.inProgress ?? refresh.isPending

  // The sheet shows a followed conference from the list, or fetches one that is only deep-linked.
  const fromList = detailsId ? items.find((i) => i.id === detailsId) : undefined
  const fetched = useConferenceDeadline(fromList || !detailsId ? undefined : detailsId)
  const detailsItem = fromList ?? (fetched.data?.id === detailsId ? fetched.data : undefined)

  let body: React.ReactNode
  if (subscriptions.isPending || followed.isPending) {
    body = <LoadingState label="Loading conferences…" />
  } else if (followed.isError) {
    body = (
      <ErrorState
        error={followed.error}
        title="Could not load your conferences"
        onRetry={() => void followed.refetch()}
      />
    )
  } else if (items.length === 0) {
    const noSource = (subscriptions.data ?? []).length === 0
    const copy = EMPTY_STATES.conferenceDeadlinesNoSubscription
    body = (
      <EmptyState
        title={noSource ? copy.title : 'No conferences chosen yet.'}
        description="Add the few conferences you care about. The CCF Deadlines list is only a source to search."
        actions={[
          { label: CREATE_LABELS.conference, onClick: openPicker },
          ...(noSource ? [{ label: copy.actions[1], onClick: () => setBuilder('custom') }] : [])
        ]}
      />
    )
  } else {
    const stale = status.data?.lastError !== undefined && !inProgress
    body = (
      <div className="flex flex-col gap-6">
        <PageAction>
          <Button size="sm" onClick={openPicker}>
            {CREATE_LABELS.conference}
          </Button>
        </PageAction>
        <span className="sr-only" data-testid="board-summary">
          {visible.length} {visible.length === 1 ? 'conference' : 'conferences'}
          {nextItem?.deadlineAt &&
            ` · next: ${nextItem.title} ${format.formatRelative(nextItem.deadlineAt, nowIso)}`}
        </span>

        {changes.data && changes.data.length > 0 && (
          <ConferenceChangesBanner
            changes={changes.data}
            busy={acknowledge.isPending}
            onAcknowledge={(ids) => acknowledge.mutate({ ids })}
            onOpen={(deadlineId) => setDetailsId(deadlineId)}
          />
        )}

        {visible.length === 0 ? (
          <EmptyState
            variant="compact"
            title="Only passed conferences remain."
            actions={[{ label: 'Show passed', onClick: () => setShowPassed(true) }]}
          />
        ) : (
          <ConferenceBoard
            items={visible}
            nowIso={nowIso}
            updatedIds={updatedIds}
            highlightId={detailsId}
            onOpen={(item) => setDetailsId(item.id)}
            header={
              <Section
                title="Following"
                count={visible.length}
                actions={
                  passedCount > 0 && (
                    <PassedToggle
                      checked={showPassed}
                      onCheckedChange={setShowPassed}
                      count={passedCount}
                    />
                  )
                }
              />
            }
          />
        )}

        <div
          className="text-meta flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-ink-3"
          data-testid="refresh-indicator"
        >
          <span className="flex flex-wrap items-baseline gap-x-2">
            {inProgress ? (
              <LoadingState variant="inline" label="Refreshing the CCF Deadlines list…" />
            ) : (
              <span>
                {status.data?.lastSuccessAt
                  ? `CCF Deadlines list updated ${format.formatRelative(status.data.lastSuccessAt, nowIso)}`
                  : 'CCF Deadlines list not loaded yet'}
              </span>
            )}
            {stale && status.data?.lastError && (
              <span className="flex items-center gap-1.5 text-signal">
                <CircleAlert className="size-3.5" aria-hidden="true" />
                Last refresh failed: {status.data.lastError.message}
              </span>
            )}
          </span>
          <span className="flex items-baseline gap-4">
            <button
              type="button"
              className="link-quiet app-no-drag"
              disabled={inProgress}
              onClick={() => refresh.mutate({ force: true })}
            >
              {stale ? 'Retry' : 'Refresh'}
            </button>
            <button
              type="button"
              className="link-quiet app-no-drag"
              onClick={() => navigate('settings', { section: 'subscriptions' })}
            >
              Sources
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      {body}
      <ConferencePicker
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open)
          if (!open && params.create !== undefined) clearDeepLink()
        }}
        onAdvanced={() => {
          setPickerOpen(false)
          setBuilder('custom')
        }}
      />
      <SubscriptionBuilder
        open={builder !== undefined}
        initialMode={builder ?? 'official'}
        onOpenChange={(open) => !open && setBuilder(undefined)}
      />
      <ConferenceSheet
        item={detailsItem}
        open={detailsItem !== undefined}
        updated={detailsId ? updatedIds.has(detailsId) : false}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsId(undefined)
            clearDeepLink()
          }
        }}
      />
    </>
  )
}
