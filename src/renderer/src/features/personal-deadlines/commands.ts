import { Timer } from 'lucide-react'
import type { Command } from '@renderer/app/commands'

/**
 * Palette commands for personal deadlines. "Add Personal Deadline" deep-links to the Deadlines
 * page's personal tab with `create`, which the tab consumes to open the editor from any page.
 */
export const personalDeadlineCommands: Command[] = [
  {
    id: 'personal-deadlines:create',
    title: 'Add Personal Deadline',
    group: 'Create',
    keywords: ['new', 'add', 'deadline', 'due', 'submission', 'personal'],
    icon: Timer,
    run: (ctx) => ctx.navigate('deadlines', { tab: 'personal', create: 'true' })
  }
]
