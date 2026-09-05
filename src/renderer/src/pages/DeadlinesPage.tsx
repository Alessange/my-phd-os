import { CalendarClock, Timer } from 'lucide-react'
import { useCallback } from 'react'
import { DEADLINES_TABS, type DeadlinesTab } from '@shared/types/settings'
import { dispatchCommand } from '@renderer/app/commandBus'
import { useNavigation } from '@renderer/app/navigation'
import {
  DEADLINES_QUICK_CREATE,
  notifyNothingToCreate,
  useRegisterQuickCreate
} from '@renderer/app/quickCreate'
import { PageHeader } from '@renderer/components/common/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { ConferenceDeadlinesTab } from '@renderer/features/conference-deadlines/components/ConferenceDeadlinesTab'
import { DeadlineSummary } from '@renderer/features/deadlines-summary/DeadlineSummary'
import { PersonalDeadlinesTab } from '@renderer/features/personal-deadlines/components/PersonalDeadlinesTab'
import { useSettings } from '@renderer/hooks/useSettings'

const isDeadlinesTab = (value: unknown): value is DeadlinesTab =>
  typeof value === 'string' && (DEADLINES_TABS as readonly string[]).includes(value)

/**
 * Deadlines: summary slot + the two tabs. The active tab is persisted in `ui.deadlinesTab`; deep
 * links pass `{ tab }`. Quick-create (`mod+N`, top bar, menu) is forwarded to the active tab's
 * feature through `DEADLINES_QUICK_CREATE`.
 */
export default function DeadlinesPage(): React.JSX.Element {
  const { ui, updateUi } = useSettings()
  const params = useNavigation((state) => state.params)
  const navigate = useNavigation((state) => state.navigate)
  const tab: DeadlinesTab = isDeadlinesTab(params.tab) ? params.tab : ui.deadlinesTab

  const quickCreate = useCallback(() => {
    if (dispatchCommand(DEADLINES_QUICK_CREATE[tab], { tab }) === 0)
      notifyNothingToCreate('deadlines')
  }, [tab])
  useRegisterQuickCreate('deadlines', quickCreate)

  const onTabChange = (value: string): void => {
    if (!isDeadlinesTab(value)) return
    navigate('deadlines', { ...params, tab: value })
    void updateUi({ deadlinesTab: value })
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="Deadlines" />
      <DeadlineSummary />
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList aria-label="Deadline type">
          <TabsTrigger value="conference">
            <CalendarClock aria-hidden="true" />
            Conference Deadlines
          </TabsTrigger>
          <TabsTrigger value="personal">
            <Timer aria-hidden="true" />
            Personal Deadlines
          </TabsTrigger>
        </TabsList>
        <TabsContent value="conference">
          <ConferenceDeadlinesTab />
        </TabsContent>
        <TabsContent value="personal">
          <PersonalDeadlinesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
