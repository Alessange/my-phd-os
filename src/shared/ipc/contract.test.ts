import { describe, expect, it } from 'vitest'
import { channelNames, channels, isChannelName } from './contract'
import { ENTITY_NAMES, EVENT_NAMES, isEntityName, isEventName } from './events'

describe('IPC contract', () => {
  it('registers every channel under its own name', () => {
    for (const [key, definition] of Object.entries(channels)) {
      expect(definition.name).toBe(key)
      expect(/^[a-z][A-Za-z]*:[a-z][A-Za-z]*$/.test(key)).toBe(true)
      expect(typeof definition.request.safeParse).toBe('function')
    }
  })

  it('covers every feature domain', () => {
    const domains = new Set(channelNames.map((name) => name.split(':')[0]))
    expect([...domains].sort()).toEqual(
      [
        'app',
        'calendar',
        'conferences',
        'data',
        'habits',
        'milestones',
        'personalDeadlines',
        'settings'
      ].sort()
    )
    expect(channelNames.length).toBeGreaterThanOrEqual(60)
  })

  it('guards channel names', () => {
    expect(isChannelName('calendar:listEvents')).toBe(true)
    expect(isChannelName('calendar:dropTables')).toBe(false)
    expect(isChannelName('toString')).toBe(false)
    expect(isChannelName(42)).toBe(false)
  })

  it('validates a request through the channel schema', () => {
    const ok = channels['calendar:updateEvent'].request.safeParse({
      id: 'e1',
      patch: { title: 'New' }
    })
    expect(ok.success).toBe(true)
    const bad = channels['calendar:updateEvent'].request.safeParse({ id: '', patch: {} })
    expect(bad.success).toBe(false)
    expect(
      channels['data:clearAllData'].request.safeParse({ confirmation: 'delete' }).success
    ).toBe(false)
    expect(
      channels['data:clearAllData'].request.safeParse({ confirmation: 'DELETE ALL DATA' }).success
    ).toBe(true)
  })

  it('accepts undefined for payload-less channels', () => {
    expect(channels['settings:get'].request.safeParse(undefined).success).toBe(true)
    expect(channels['conferences:refresh'].request.safeParse(undefined).success).toBe(true)
    expect(channels['conferences:refresh'].request.safeParse({ force: true }).success).toBe(true)
    expect(channels['habits:list'].request.safeParse({ includeArchived: true }).success).toBe(true)
  })
})

describe('IPC events', () => {
  it('names the four push events and twelve entities', () => {
    expect(EVENT_NAMES).toEqual([
      'data:changed',
      'conferences:refreshStatus',
      'app:command',
      'app:navigate'
    ])
    expect(ENTITY_NAMES).toHaveLength(12)
    expect(isEntityName('calendarEvents')).toBe(true)
    expect(isEntityName('users')).toBe(false)
    expect(isEventName('app:navigate')).toBe(true)
    expect(isEventName('app:quit')).toBe(false)
  })
})
