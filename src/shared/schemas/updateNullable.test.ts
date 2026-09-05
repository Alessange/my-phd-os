import { describe, expect, it } from 'vitest'
import { updateHabitInputSchema } from './habit'
import { updateMilestoneInputSchema } from './milestone'
import { updatePersonalDeadlineInputSchema } from './personalDeadline'

/** Update schemas let optional fields be cleared with `null`; required fields still reject it. */
describe('update schemas: clearing optional fields', () => {
  it('personal deadlines clear description, sourceUrl, location and linkedMilestoneId with null', () => {
    const parsed = updatePersonalDeadlineInputSchema.parse({
      description: null,
      sourceUrl: null,
      location: null,
      linkedMilestoneId: null
    })
    expect(parsed).toEqual({
      description: null,
      sourceUrl: null,
      location: null,
      linkedMilestoneId: null
    })
    expect(updatePersonalDeadlineInputSchema.safeParse({ title: null }).success).toBe(false)
    expect(updatePersonalDeadlineInputSchema.safeParse({ tags: null }).success).toBe(false)
  })

  it('milestones clear description and color with null', () => {
    expect(updateMilestoneInputSchema.parse({ description: null, color: null })).toEqual({
      description: null,
      color: null
    })
    expect(updateMilestoneInputSchema.safeParse({ title: null }).success).toBe(false)
  })

  it('habits clear the icon with null', () => {
    expect(updateHabitInputSchema.parse({ icon: null })).toEqual({ icon: null })
    expect(updateHabitInputSchema.safeParse({ color: null }).success).toBe(false)
  })
})

describe('calendar event update schema: clearing optional fields', () => {
  it('clears description, location, url and recurrenceRule with null', async () => {
    const { updateCalendarEventInputSchema } = await import('./calendar')
    expect(
      updateCalendarEventInputSchema.parse({
        description: null,
        location: null,
        url: null,
        recurrenceRule: null
      })
    ).toEqual({ description: null, location: null, url: null, recurrenceRule: null })
    expect(updateCalendarEventInputSchema.safeParse({ title: null }).success).toBe(false)
  })
})
