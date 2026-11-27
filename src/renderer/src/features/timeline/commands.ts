import { Route } from 'lucide-react'
import type { Command } from '@renderer/app/commands'
import { CREATE_LABELS } from '@renderer/app/navigation'

/**
 * Palette commands for the timeline. "Add milestone" navigates to Timeline with a `create` param
 * that the page consumes to open the editor, so it works from any page (the per-page `mod+N`
 * handler is registered by the page itself).
 */
export const timelineCommands: Command[] = [
  {
    id: 'timeline:create',
    title: CREATE_LABELS.milestone,
    group: 'Create',
    keywords: ['new', 'add', 'milestone', 'timeline', 'plan', 'semester', 'phd'],
    icon: Route,
    run: (ctx) => ctx.navigate('timeline', { create: 'true' })
  }
]
