import { CalendarDays, Import, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { dispatchCommand, useCommandListener } from '@renderer/app/commandBus'
import { useRegisterQuickCreate } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { PendingFeatureDialog } from '@renderer/components/common/PendingFeatureDialog'
import { Button } from '@renderer/components/ui/button'
import { FollowedConferenceCompact } from '@renderer/features/conference-deadlines/components/FollowedConferenceCompact'
import { TodayHabitsCompact } from '@renderer/features/habits/components/TodayHabitsCompact'
import { PersonalDeadlineCompact } from '@renderer/features/personal-deadlines/components/PersonalDeadlineCompact'

type Pending = 'import' | 'create' | undefined

function PanelSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={`panel-${title}`} className="flex flex-col gap-2">
      <h2
        id={`panel-${title}`}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * Layout skeleton for the Calendar page: toolbar row, calendar body, and the "Today & Upcoming"
 * right panel (collapses under ~1180 px). The calendar feature replaces the body and toolbar;
 * keep this default export name.
 */
export default function CalendarPage(): React.JSX.Element {
  const [pending, setPending] = useState<Pending>()
  const openImport = useCallback(() => setPending('import'), [])
  const openCreate = useCallback(() => setPending('create'), [])

  // Shell-phase handlers: the calendar feature takes over these commands when it lands.
  useCommandListener('import-ics', openImport)
  useRegisterQuickCreate('calendar', openCreate)

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col" aria-labelledby="calendar-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          <h1 id="calendar-heading" className="text-[15px] font-semibold">
            Calendar
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => dispatchCommand('import-ics')}>
              <Import aria-hidden="true" />
              Import .ics
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden="true" />
              Add Event
            </Button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={CalendarDays}
            title={EMPTY_STATES.calendar.title}
            description="Import an existing .ics calendar or create your first event. Week view opens by default; change it in Settings."
            actions={[
              {
                label: EMPTY_STATES.calendar.actions[0],
                onClick: () => dispatchCommand('import-ics'),
                variant: 'outline',
                icon: Import
              },
              {
                label: EMPTY_STATES.calendar.actions[1],
                onClick: openCreate,
                variant: 'default',
                icon: Plus
              }
            ]}
          />
        </div>
      </section>

      <aside
        aria-label="Today and upcoming"
        className="hidden w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-sidebar/40 p-4 min-[1180px]:flex"
      >
        <PanelSection title="Today">
          <EmptyState variant="compact" title={EMPTY_STATES.todayEvents.title} />
          <EmptyState variant="compact" title={EMPTY_STATES.nextEvent.title} />
        </PanelSection>
        <PanelSection title="Nearest deadline">
          <PersonalDeadlineCompact />
          <FollowedConferenceCompact />
        </PanelSection>
        <PanelSection title="Today’s habits">
          <TodayHabitsCompact />
        </PanelSection>
      </aside>

      <PendingFeatureDialog
        open={pending !== undefined}
        onOpenChange={(open) => !open && setPending(undefined)}
        title={pending === 'import' ? 'Import .ics' : 'Create Event'}
        description={
          pending === 'import'
            ? 'The import flow (native file picker, drag-and-drop, preview with duplicate detection) opens here once the calendar feature is installed.'
            : 'The event editor opens here once the calendar feature is installed.'
        }
      />
    </div>
  )
}
