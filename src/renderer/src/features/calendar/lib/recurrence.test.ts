import { describe, expect, it } from 'vitest'
import {
  buildRecurrenceRule,
  describeRecurrence,
  recurrenceDraftFromRule,
  validateRecurrenceRule
} from './recurrence'

describe('recurrence drafts', () => {
  it('builds preset rules from the start date and round-trips them', () => {
    // 2026-09-08 is a Tuesday.
    expect(
      buildRecurrenceRule({ preset: 'weekly', end: { kind: 'never' }, custom: '' }, '2026-09-08')
    ).toBe('FREQ=WEEKLY;BYDAY=TU')
    expect(
      buildRecurrenceRule(
        { preset: 'biweekly', end: { kind: 'count', count: 6 }, custom: '' },
        '2026-09-08'
      )
    ).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;COUNT=6')
    expect(
      buildRecurrenceRule(
        { preset: 'monthly', end: { kind: 'until', date: '2027-06-30' }, custom: '' },
        '2026-09-08'
      )
    ).toBe('FREQ=MONTHLY;BYMONTHDAY=8;UNTIL=20270630T235959Z')
    expect(
      buildRecurrenceRule({ preset: 'none', end: { kind: 'never' }, custom: '' }, '2026-09-08')
    ).toBeUndefined()
    expect(
      recurrenceDraftFromRule('FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T075959Z', '2026-09-08')
    ).toEqual({
      preset: 'weekly',
      end: { kind: 'until', date: '2026-12-15' },
      custom: ''
    })
    expect(
      recurrenceDraftFromRule('BYDAY=TU;INTERVAL=2;FREQ=WEEKLY;COUNT=6', '2026-09-08')
    ).toEqual({
      preset: 'biweekly',
      end: { kind: 'count', count: 6 },
      custom: ''
    })
  })

  it('keeps anything else as a custom rule and validates raw text', () => {
    const draft = recurrenceDraftFromRule('FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=4', '2026-09-30')
    expect(draft.preset).toBe('custom')
    expect(buildRecurrenceRule(draft, '2026-09-30')).toBe('FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=4')
    expect(validateRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,WE')).toBeUndefined()
    expect(validateRecurrenceRule('RRULE:FREQ=DAILY;COUNT=3')).toBeUndefined()
    expect(validateRecurrenceRule('')).toMatch(/Enter a rule/)
    expect(validateRecurrenceRule('BYDAY=MO')).toMatch(/FREQ/)
    expect(validateRecurrenceRule('FREQ=SOMETIMES')).toBeDefined()
  })

  it('describes rules in words', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=TU')).toBe('every week on Tuesday')
    expect(describeRecurrence(undefined)).toBeUndefined()
  })
})
