import { describe, expect, it, vi } from 'vitest'
import { subscribeCommand } from './commandBus'
import { shellCommands } from './commands'

describe('shell commands', () => {
  it('opens the .ics import on a calendar page that mounts after the page switch', () => {
    const command = shellCommands.find((entry) => entry.id === 'import-ics')
    expect(command).toBeDefined()
    const navigate = vi.fn()
    command?.run({ navigate } as never)
    expect(navigate).toHaveBeenCalledWith('calendar')

    const listener = vi.fn()
    const off = subscribeCommand('import-ics', listener)
    expect(listener).toHaveBeenCalledOnce()
    off()
  })
})
