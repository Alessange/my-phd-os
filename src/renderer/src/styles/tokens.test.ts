import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
const block = (selector: string): string => {
  const start = css.indexOf(`${selector} {`)
  return css.slice(start, css.indexOf('\n}', start))
}
const light = block(':root')
const dark = block('.dark')
const theme = block('@theme inline')

const tokens = [
  ...Object.values(CATEGORIES),
  ...Object.values(DEADLINE_STATUS_DEFINITIONS),
  ...Object.values(PERSONAL_DEADLINE_STATUS_DEFINITIONS),
  ...Object.values(PRIORITY_DEFINITIONS),
  ...Object.values(CONFERENCE_STATUS_DEFINITIONS),
  ...Object.values(MILESTONE_STATUS_DEFINITIONS),
  ...Object.values(ICS_IMPORT_ITEM_STATUS_DEFINITIONS),
  ...Object.values(REFRESH_OUTCOME_DEFINITIONS)
].map((definition) => definition.colorToken)

describe('globals.css theme tokens', () => {
  it.each([...new Set(tokens)])('defines "%s" for light, dark and the Tailwind theme', (token) => {
    expect(light).toContain(`--${token}:`)
    expect(dark).toContain(`--${token}:`)
    expect(theme).toContain(`--color-${token}: var(--${token})`)
  })
})
