import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '@shared/constants/categories'
import {
  CONFERENCE_STATUS_DEFINITIONS,
  DEADLINE_STATUS_DEFINITIONS,
  ICS_IMPORT_ITEM_STATUS_DEFINITIONS,
  MILESTONE_STATUS_DEFINITIONS,
  PERSONAL_DEADLINE_STATUS_DEFINITIONS,
  PRIORITY_DEFINITIONS,
  REFRESH_OUTCOME_DEFINITIONS
} from '@shared/constants/statuses'
import { ICONS_BY_NAME } from './icons'

const iconNames = [
  ...Object.values(CATEGORIES),
  ...Object.values(DEADLINE_STATUS_DEFINITIONS),
  ...Object.values(PERSONAL_DEADLINE_STATUS_DEFINITIONS),
  ...Object.values(PRIORITY_DEFINITIONS),
  ...Object.values(CONFERENCE_STATUS_DEFINITIONS),
  ...Object.values(MILESTONE_STATUS_DEFINITIONS),
  ...Object.values(ICS_IMPORT_ITEM_STATUS_DEFINITIONS),
  ...Object.values(REFRESH_OUTCOME_DEFINITIONS)
].map((definition) => definition.icon)

describe('icon map', () => {
  it.each([...new Set(iconNames)])(
    'maps "%s" from the shared constants to a lucide component',
    (name) => {
      expect(ICONS_BY_NAME[name]).toBeDefined()
    }
  )
})
