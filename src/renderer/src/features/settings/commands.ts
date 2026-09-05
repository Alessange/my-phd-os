import { Download, Upload } from 'lucide-react'
import type { Command } from '@renderer/app/commands'
import { dispatchCommand } from '@renderer/app/commandBus'

/** Backup commands jump to Settings › Data and start the flow there (the section subscribes on the bus). */
export const settingsCommands: Command[] = [
  {
    id: 'settings:export-backup',
    title: 'Export JSON backup',
    group: 'Settings',
    keywords: ['backup', 'export', 'json', 'save', 'data'],
    icon: Download,
    run: (ctx) => {
      ctx.navigate('settings', { section: 'data' })
      dispatchCommand('settings:export-backup')
    }
  },
  {
    id: 'settings:import-backup',
    title: 'Import JSON backup',
    group: 'Settings',
    keywords: ['backup', 'import', 'restore', 'json', 'data'],
    icon: Upload,
    run: (ctx) => {
      ctx.navigate('settings', { section: 'data' })
      dispatchCommand('settings:import-backup')
    }
  }
]
