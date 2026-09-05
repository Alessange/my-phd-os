import { CalendarDays, CalendarPlus, Columns3, Download, List, Square } from 'lucide-react'
import type { Command } from '@renderer/app/commands'
import { dispatchCommand } from '@renderer/app/commandBus'
import type { CalendarViewId } from '@shared/types/calendar'

const VIEW_COMMANDS: {
  view: CalendarViewId
  title: string
  icon: Command['icon']
  keywords: string[]
}[] = [
  { view: 'dayGridMonth', title: 'Calendar: Month view', icon: CalendarDays, keywords: ['month'] },
  { view: 'timeGridWeek', title: 'Calendar: Week view', icon: Columns3, keywords: ['week'] },
  { view: 'timeGridDay', title: 'Calendar: Day view', icon: Square, keywords: ['day'] },
  { view: 'listWeek', title: 'Calendar: Agenda view', icon: List, keywords: ['agenda', 'list'] }
]

/** Palette commands for the calendar; each lands on the page and speaks to it over the command bus. */
export const calendarCommands: Command[] = [
  {
    id: 'calendar:create-event',
    title: 'Add Event',
    group: 'Create',
    keywords: ['new', 'add', 'event', 'calendar', 'meeting'],
    icon: CalendarPlus,
    run: (ctx) => {
      ctx.navigate('calendar')
      dispatchCommand('calendar:create')
    }
  },
  {
    id: 'calendar:export-ics',
    title: 'Export calendar (.ics)',
    group: 'Calendar',
    keywords: ['export', 'ics', 'ical', 'calendar', 'save'],
    icon: Download,
    run: (ctx) => {
      ctx.navigate('calendar')
      dispatchCommand('calendar:export')
    }
  },
  ...VIEW_COMMANDS.map(({ view, title, icon, keywords }): Command => ({
    id: `calendar:view-${view}`,
    title,
    group: 'Calendar',
    keywords: ['calendar', 'view', ...keywords],
    icon,
    run: (ctx) => {
      ctx.navigate('calendar')
      dispatchCommand('calendar:view', { view })
    }
  }))
]
