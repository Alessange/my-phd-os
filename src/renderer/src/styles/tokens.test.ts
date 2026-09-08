import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
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

/**
 * Palette colours must be read at runtime through the raw `--<token>` property. `@theme inline`
 * resolves `--color-<token>` at build time, and Tailwind emits it only when a utility class it can
 * see in the source uses it — so a palette colour looked up by theme name from TypeScript or from
 * hand-written CSS silently resolves to nothing. That shipped three times: transparent chips, an
 * invisible conference bar, and calendar events drawn as uncoloured boxes.
 */
const SRC = resolve(__dirname, '../..')
const THIS_FILE = resolve(__filename)
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full)
    if (full === THIS_FILE) return [] // this file quotes the very patterns it forbids
    return ['.ts', '.tsx', '.css'].includes(extname(entry.name)) ? [full] : []
  })

describe('palette colours are referenced by their raw property', () => {
  const paletteTokens = [...new Set(tokens)]

  it.each(paletteTokens)('no source file reads "%s" through the theme name', (token) => {
    const offenders = sourceFiles(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes(`var(--color-${token})`))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })

  it('catches a dynamic lookup built from a token name', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => /var\(--color-\$\{/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })
})
