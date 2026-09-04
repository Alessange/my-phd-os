import { describe, expect, it } from 'vitest'
import { resolveZone } from '../dates/zones'
import { CALENDAR_EVENT_CATEGORIES } from '../types/calendar'
import { MILESTONE_CATEGORIES } from '../types/milestone'
import { PERSONAL_DEADLINE_CATEGORIES } from '../types/personalDeadline'
import { CATEGORIES, CATEGORY_IDS } from './categories'
import { CCF_SUBJECTS, CORE_RANK_OPTIONS, encodeRankForUrl } from './ccf'
import { EMPTY_STATES } from './emptyStates'
import { APPROVED_SUBSCRIPTION_HOSTS, isApprovedSubscriptionUrl, OFFICIAL_FEED_URLS } from './hosts'
import { formatShortcut, SHORTCUTS } from './shortcuts'
import { DEADLINE_STATUS_DEFINITIONS } from './statuses'
import { TIMEZONE_OPTION_IDS, TIMEZONE_OPTIONS } from './timezones'

describe('categories', () => {
  it('covers every category id used by the three domains', () => {
    for (const id of [
      ...CALENDAR_EVENT_CATEGORIES,
      ...PERSONAL_DEADLINE_CATEGORIES,
      ...MILESTONE_CATEGORIES
    ]) {
      expect(CATEGORIES[id]).toBeDefined()
      expect(CATEGORIES[id].id).toBe(id)
      expect(CATEGORIES[id].label.length).toBeGreaterThan(0)
      expect(CATEGORIES[id].colorToken).toMatch(/^category-[a-z-]+$/)
      expect(CATEGORIES[id].icon.length).toBeGreaterThan(0)
    }
    expect(new Set(CATEGORY_IDS).size).toBe(CATEGORY_IDS.length)
  })
})

describe('statuses', () => {
  it('has text, icon and color for every computed deadline status', () => {
    for (const def of Object.values(DEADLINE_STATUS_DEFINITIONS)) {
      expect(def.label).not.toBe('')
      expect(def.icon).not.toBe('')
      expect(def.colorToken).toMatch(/^status-/)
    }
    expect(DEADLINE_STATUS_DEFINITIONS.on_track.label).toBe('On Track')
    expect(DEADLINE_STATUS_DEFINITIONS.at_risk.label).toBe('At Risk')
  })
})

describe('hosts', () => {
  it('approves only https ccfddl.com', () => {
    expect(APPROVED_SUBSCRIPTION_HOSTS).toEqual(['https://ccfddl.com'])
    expect(isApprovedSubscriptionUrl(OFFICIAL_FEED_URLS.en)).toBe(true)
    expect(isApprovedSubscriptionUrl(OFFICIAL_FEED_URLS.zh)).toBe(true)
    expect(isApprovedSubscriptionUrl('http://ccfddl.com/conference/deadlines_en.ics')).toBe(false)
    expect(isApprovedSubscriptionUrl('https://ccfddl.com.evil.org/x.ics')).toBe(false)
    expect(isApprovedSubscriptionUrl('https://example.com/deadlines.ics')).toBe(false)
    expect(isApprovedSubscriptionUrl('not a url')).toBe(false)
  })
})

describe('shortcuts', () => {
  it('lists the spec shortcut table', () => {
    const ids = SHORTCUTS.map((s) => s.id)
    expect(ids).toEqual([
      'command-palette',
      'quick-create',
      'import-ics',
      'settings',
      'page-calendar',
      'page-deadlines',
      'page-timeline',
      'page-habits',
      'page-settings',
      'calendar-today',
      'close-overlay'
    ])
    expect(formatShortcut(SHORTCUTS[0], 'darwin')).toBe('⌘K')
    expect(formatShortcut(SHORTCUTS[0], 'other')).toBe('Ctrl+K')
    expect(formatShortcut(SHORTCUTS.at(-1)!, 'darwin')).toBe('Esc')
    expect(SHORTCUTS.find((s) => s.id === 'calendar-today')?.scope).toBe('calendar')
  })
})

describe('empty states', () => {
  it('uses the exact spec copy', () => {
    expect(EMPTY_STATES.calendar.title).toBe('Your calendar is empty.')
    expect(EMPTY_STATES.calendar.actions).toEqual(['Import .ics', 'Create Event'])
    expect(EMPTY_STATES.conferenceDeadlinesNoSubscription.title).toBe(
      'No conference subscription yet.'
    )
    expect(EMPTY_STATES.personalDeadlines.title).toBe('No personal deadlines yet.')
    expect(EMPTY_STATES.timeline.title).toBe('Your timeline starts here.')
    expect(EMPTY_STATES.habits.title).toBe('No habits yet.')
    expect(EMPTY_STATES.habits.actions).toEqual(['Create Habit'])
  })
})

describe('timezones', () => {
  it('starts with system and resolves every option', () => {
    expect(TIMEZONE_OPTIONS[0].options[0].id).toBe('system')
    expect(TIMEZONE_OPTION_IDS.length).toBeGreaterThanOrEqual(60)
    expect(new Set(TIMEZONE_OPTION_IDS).size).toBe(TIMEZONE_OPTION_IDS.length)
    for (const id of TIMEZONE_OPTION_IDS) expect(() => resolveZone(id)).not.toThrow()
    expect(TIMEZONE_OPTION_IDS).toContain('UTC-12:00')
    expect(TIMEZONE_OPTION_IDS).toContain('UTC+14:00')
  })
})

describe('ccf', () => {
  it('lists the ten upstream subjects and encodes A*', () => {
    expect(CCF_SUBJECTS.map((s) => s.code)).toEqual([
      'DS',
      'NW',
      'SC',
      'SE',
      'DB',
      'CT',
      'CG',
      'AI',
      'HI',
      'MX'
    ])
    expect(encodeRankForUrl('A*')).toBe('Astar')
    expect(CORE_RANK_OPTIONS.map((r) => r.urlSegment)).toEqual(['Astar', 'A', 'B', 'C'])
  })
})
