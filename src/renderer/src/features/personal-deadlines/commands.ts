import { Timer } from 'lucide-react'
import type { Command } from '@renderer/app/commands'
import { CREATE_LABELS } from '@renderer/app/navigation'

/**
 * Palette commands for personal deadlines. "Add personal deadline" deep-links to the Deadlines
 * page's personal tab with `create`, which the tab consumes to open the editor from any page.
 */
export const personalDeadlineCommands: Command[] = [
  {
    id: 'personal-deadlines:create',
    title: CREATE_LABELS.personalDeadline,
    group: 'Create',
    keywords: ['new', 'add', 'deadline', 'due', 'submission', 'personal'],
    icon: Timer,
    run: (ctx) => ctx.navigate('deadlines', { tab: 'personal', create: 'true' })
  }
]
