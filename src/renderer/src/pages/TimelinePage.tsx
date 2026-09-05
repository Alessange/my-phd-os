import { ChevronLeft, ChevronRight, Plus, Route } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import {
  detectTimelineWarnings,
  type TimelineWarning
} from '@shared/timeline/detectTimelineWarnings'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import type { Milestone } from '@shared/types/milestone'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import type { TimelineView } from '@shared/types/settings'
import { useNavigation } from '@renderer/app/navigation'
import { useRegisterQuickCreate } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { PageHeader } from '@renderer/components/common/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { useFollowedConferences } from '@renderer/features/conference-deadlines/api'
import { usePersonalDeadlines } from '@renderer/features/personal-deadlines/api'
import {
  useDismissWarning,
  useDismissedWarnings,
  useMilestones,
  useRestoreWarning
} from '@renderer/features/timeline/api'
import { MilestoneForm } from '@renderer/features/timeline/components/MilestoneForm'
import { TimelineGantt } from '@renderer/features/timeline/components/TimelineGantt'
import { TimelineList } from '@renderer/features/timeline/components/TimelineList'
import { TimelineWarnings } from '@renderer/features/timeline/components/TimelineWarnings'
import { computeTimelineWindow } from '@renderer/features/timeline/layout'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { useSettings } from '@renderer/hooks/useSettings'

const VIEW_OPTIONS: readonly { value: TimelineView; label: string }[] = [
  { value: 'semester', label: 'Semester' },
  { value: 'year', label: 'Year' },
  { value: 'multiYear', label: 'Multi-year' },
  { value: 'list', label: 'List' }
]

const NO_MILESTONES: Milestone[] = []
const NO_DEADLINES: PersonalDeadline[] = []
const NO_CONFERENCES: ConferenceDeadlineView[] = []

/**
 * Timeline page (spec §15): four views over the same milestones (semester / year / multi-year
 * Gantts and a chronological list), range controls for the anchored views, the timeline checks
 * panel with Open/Dismiss, and the milestone editor. The active view persists in `ui.timelineView`;
 * deep links: `{ milestoneId }` opens that milestone, `{ create }` opens the editor for a new one.
 */
export default function TimelinePage(): React.JSX.Element {
  const { ui, updateUi, settings } = useSettings()
  const { formatDate } = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const params = useNavigation((state) => state.params)
  const navigate = useNavigation((state) => state.navigate)

  const milestonesQuery = useMilestones()
  const deadlinesQuery = usePersonalDeadlines({ includeCompleted: true })
  const followedQuery = useFollowedConferences()
  const dismissedQuery = useDismissedWarnings()
  const dismiss = useDismissWarning()
  const restore = useRestoreWarning()
  const milestones = milestonesQuery.data ?? NO_MILESTONES
  const deadlines = deadlinesQuery.data ?? NO_DEADLINES
  const followed = followedQuery.data ?? NO_CONFERENCES

  const view = ui.timelineView
  const [offset, setOffset] = useState(0)
  const changeView = (next: TimelineView): void => {
    setOffset(0)
    void updateUi({ timelineView: next })
  }

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Milestone | undefined>()
  const openCreate = useCallback(() => {
    setEditing(undefined)
    setFormOpen(true)
  }, [])
  const openEdit = useCallback((milestone: Milestone) => {
    setEditing(milestone)
    setFormOpen(true)
  }, [])
  useRegisterQuickCreate('timeline', openCreate)

  // Deep links, derived during render (see SettingsPage). Each tracks the param's current value so
  // it fires on every arrival, including a repeat after the param was cleared on close.
  const [lastCreate, setLastCreate] = useState<string | undefined>()
  if (params.create !== lastCreate) {
    setLastCreate(params.create)
    if (params.create !== undefined) {
      setEditing(undefined)
      setFormOpen(true)
    }
  }
  const [lastMilestoneId, setLastMilestoneId] = useState<string | undefined>()
  if (params.milestoneId !== lastMilestoneId) {
    const target =
      params.milestoneId === undefined
        ? undefined
        : milestones.find((m) => m.id === params.milestoneId)
    // An unknown id is ignored; one that arrives before the list has loaded is retried next render.
    if (params.milestoneId === undefined || target) {
      setLastMilestoneId(params.milestoneId)
      if (target) {
        setEditing(target)
        setFormOpen(true)
      }
    }
  }
  const onFormOpenChange = (open: boolean): void => {
    setFormOpen(open)
    if (!open) {
      setEditing(undefined)
      if (params.create !== undefined || params.milestoneId !== undefined) navigate('timeline')
    }
  }

  const warnings = useMemo(
    () => detectTimelineWarnings(milestones, deadlines, nowIso, settings.weekStartsOn),
    [milestones, deadlines, nowIso, settings.weekStartsOn]
  )
  const dismissedKeys = useMemo(
    () => new Set((dismissedQuery.data ?? []).map((d) => d.key)),
    [dismissedQuery.data]
  )
  const openWarnings = warnings.filter((w) => !dismissedKeys.has(w.id))
  const dismissedWarnings = warnings.filter((w) => dismissedKeys.has(w.id))

  const window = useMemo(
    () => computeTimelineWindow(milestones, nowIso, view, offset),
    [milestones, nowIso, view, offset]
  )
  const rangeLabel = window
    ? `${formatDate(new Date(window.startMs).toISOString())} – ${formatDate(new Date(window.endMs).toISOString())}`
    : ''

  const openWarning = (warning: TimelineWarning): void => {
    if (warning.navigateTo.kind === 'timeline') {
      const target = milestones.find((m) => m.id === warning.navigateTo.milestoneId)
      if (target) openEdit(target)
      return
    }
    navigate(
      'deadlines',
      warning.navigateTo.deadlineId
        ? { tab: 'personal', id: warning.navigateTo.deadlineId }
        : { tab: 'personal' }
    )
  }

  let body: React.ReactNode
  if (milestonesQuery.isPending) {
    body = <LoadingState label="Loading timeline…" />
  } else if (milestonesQuery.isError) {
    body = (
      <ErrorState
        error={milestonesQuery.error}
        title="Could not load your timeline"
        onRetry={() => void milestonesQuery.refetch()}
      />
    )
  } else if (milestones.length === 0) {
    body = (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={Route}
          title={EMPTY_STATES.timeline.title}
          description="Add a milestone with a start and target date to see where you are in the semester, the year, and the whole programme."
          actions={[{ label: EMPTY_STATES.timeline.actions[0], onClick: openCreate, icon: Plus }]}
        />
      </div>
    )
  } else {
    body = (
      <>
        {deadlinesQuery.isError && (
          <ErrorState
            variant="compact"
            error={deadlinesQuery.error}
            title="Linked deadlines could not be loaded"
            onRetry={() => void deadlinesQuery.refetch()}
          />
        )}
        {followedQuery.isError && (
          <ErrorState
            variant="compact"
            error={followedQuery.error}
            title="Followed conferences could not be loaded"
            onRetry={() => void followedQuery.refetch()}
          />
        )}
        {dismissedQuery.isError && (
          <ErrorState
            variant="compact"
            error={dismissedQuery.error}
            title="Dismissed checks could not be loaded"
            onRetry={() => void dismissedQuery.refetch()}
          />
        )}
        {!dismissedQuery.isPending && (
          <TimelineWarnings
            warnings={openWarnings}
            dismissed={dismissedWarnings}
            onOpen={openWarning}
            onDismiss={(w) =>
              dismiss.mutate({
                key: w.id,
                payload: { rule: w.rule, milestoneIds: w.milestoneIds, deadlineIds: w.deadlineIds }
              })
            }
            onRestore={(w) => restore.mutate({ key: w.id })}
          />
        )}
        {view === 'list' ? (
          <TimelineList milestones={milestones} nowIso={nowIso} onEditMilestone={openEdit} />
        ) : (
          window && (
            <TimelineGantt
              milestones={milestones}
              deadlines={deadlines}
              conferences={followed}
              nowIso={nowIso}
              view={view}
              window={window}
              onEditMilestone={openEdit}
              onOpenConference={(conference) =>
                navigate('deadlines', { tab: 'conference', id: conference.id })
              }
            />
          )
        )}
      </>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <PageHeader
        title="Timeline"
        subtitle="Your long-term PhD plan: milestones as time bars with work progress, against today."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden="true" />
            Add Milestone
          </Button>
        }
      >
        {milestones.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              aria-label="Timeline view"
              size="sm"
              value={view}
              onValueChange={changeView}
              options={VIEW_OPTIONS}
            />
            {window && view !== 'multiYear' && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Previous range"
                  onClick={() => setOffset((o) => o - 1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(0)}
                  disabled={offset === 0}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Next range"
                  onClick={() => setOffset((o) => o + 1)}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            )}
            {window && <span className="tabular text-xs text-muted-foreground">{rangeLabel}</span>}
          </div>
        )}
      </PageHeader>
      {body}
      <MilestoneForm open={formOpen} onOpenChange={onFormOpenChange} milestone={editing} />
    </div>
  )
}
