import type { Handlers } from '../registry'
import { appHandlers } from './app'
import { calendarHandlers } from './calendar'
import { conferenceHandlers } from './conferences'
import { dataHandlers } from './data'
import { habitHandlers } from './habits'
import { milestoneHandlers } from './milestones'
import { personalDeadlineHandlers } from './personalDeadlines'
import { settingsHandlers } from './settings'

/** Every channel in the contract must appear here; TypeScript rejects a missing one. */
export const handlers: Handlers = {
  ...appHandlers,
  ...settingsHandlers,
  ...calendarHandlers,
  ...personalDeadlineHandlers,
  ...conferenceHandlers,
  ...milestoneHandlers,
  ...habitHandlers,
  ...dataHandlers
}
