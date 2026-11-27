import { Repeat } from 'lucide-react'
import type { Command } from '@renderer/app/commands'
import { CREATE_LABELS } from '@renderer/app/navigation'

/**
 * Palette commands for habits. "Create habit" navigates to Habits with a `create` param that the
 * page consumes to open the form — robust whether the user is already on Habits or coming from
 * another page (the per-page `mod+N` handler is registered by the page itself).
 */
export const habitCommands: Command[] = [
  {
    id: 'habits:create',
    title: CREATE_LABELS.habit,
    group: 'Create',
    keywords: ['new', 'add', 'habit', 'routine', 'streak'],
    icon: Repeat,
    run: (ctx) => ctx.navigate('habits', { create: 'true' })
  }
]
