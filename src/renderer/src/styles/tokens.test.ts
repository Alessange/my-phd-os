import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio, parsePairs, themeTokens, tokenHex } from './contrast'
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
    // The dark block may inherit a palette token: `--status-urgent: var(--signal)` in :root is
    // re-resolved against the dark `--signal` because `.dark` sits on the same <html> element.
    expect(dark.includes(`--${token}:`) || light.includes(`--${token}: var(--`)).toBe(true)
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

/**
 * Contrast regression (DESIGN.md section 11): the text and surface pairs the design names, in both
 * themes. Text >= 4.5:1 (primary text 7:1), control edges and the focus ink >= 3:1; hairlines are
 * decoration only so they get a floor, not a target. Pure computation (see ./contrast.ts).
 */
const NAMED_PAIRS =
  // text tiers on every surface they appear on (paper, muted, accent, popover, hover/selected/track washes)
  'ink/paper:7,ink/muted:7,ink/accent:7,ink/popover:7,ink/mix(ink,5,paper):7,ink/mix(ink,7,paper):7,ink/mix(ink,8,paper):7,ink/mix(ink,10,paper):7,' +
  'ink-2/paper:7,ink-2/muted:7,ink-2/accent:7,ink-2/popover:7,ink-2/mix(ink,5,paper):7,ink-2/mix(ink,7,paper):7,ink-2/mix(ink,8,paper):4.5,ink-2/mix(ink,10,paper):4.5,' +
  'ink-3/paper:4.5,ink-3/muted:4.5,ink-3/accent:4.5,ink-3/popover:4.5,ink-3/mix(ink,5,paper):4.5,ink-3/mix(ink,7,paper):4.5,ink-3/mix(ink,8,paper):4.5,ink-3/mix(ink,10,paper):4.5,' +
  // the one signal ink: text and glyph on the grounds it sits on, and its solid confirm button
  'signal/paper:4.5,signal/muted:4.5,signal/accent:4.5,signal/popover:4.5,signal/mix(ink,5,paper):4.5,signal/mix(ink,7,paper):4.5,signal-ink/signal:4.5,' +
  // primary button, shadcn names
  'primary-foreground/primary:7,foreground/background:7,muted-foreground/background:4.5,destructive/background:4.5,destructive-foreground/destructive:4.5,' +
  // controls and focus: 3:1 non-text contrast
  'edge/paper:3,edge/muted:3,edge/popover:3,edge/mix(ink,5,paper):3,ring/paper:3,' +
  // data ink
  'cell-done/paper:3,cell-done/mix(ink,11,paper):3,cell-done/mix(ink,13,paper):3,progress-time/mix(ink,10,paper):3,progress-time/mix(ink,12,paper):3,' +
  'event-rule/mix(ink,5,paper):3,event-rule/mix(ink,8,paper):3,event-rule-past/mix(ink,5,paper):3,event-rule-past/mix(ink,8,paper):3,' +
  // structure only (hairlines are never the sole cue) and disabled text
  'line-strong/paper:1.3,line/paper:1.15,ink-4/paper:2.5,' +
  // status inks (text, always beside a word), priority and the two palette samples
  'status-urgent/paper:4.5,status-overdue/paper:4.5,status-completed/paper:4.5,status-passed/paper:4.5,status-tbd/paper:4.5,status-at-risk/paper:4.5,status-behind/paper:4.5,status-ahead/paper:4.5,status-on-track/paper:4.5,status-neutral/paper:4.5,' +
  'priority-low/paper:4.5,priority-medium/paper:4.5,priority-high/paper:4.5,priority-critical/paper:4.5,category-research/paper:4.5,category-other/paper:4.5,conference-1/paper:4.5,conference-10/paper:4.5'

const tables = themeTokens(css)

describe.each(['light', 'dark'] as const)('contrast pairs, %s theme', (theme) => {
  it.each(parsePairs(NAMED_PAIRS).map((pair) => [`${pair.fg} on ${pair.bg}`, pair] as const))(
    '%s meets its minimum',
    (_name, pair) => {
      expect(contrastRatio(pair.fg, pair.bg, tables[theme])).toBeGreaterThanOrEqual(pair.min)
    }
  )

  it('every status, priority and category token resolves to an ink (no chroma outside signal)', () => {
    for (const token of [...new Set(tokens)]) {
      const value = tables[theme][token]
      expect(value, `--${token}`).toMatch(/^var\(--(ink-?\d?|signal)\)$/)
    }
  })
})

describe('typeface and weights', () => {
  it('declares the three bundled Linux Biolinum faces with relative urls and font-display: block', () => {
    const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((match) => match[1])
    expect(faces).toHaveLength(3)
    for (const face of faces) {
      expect(face).toContain("font-family: 'Linux Biolinum'")
      expect(face).toMatch(/url\('\.\.\/assets\/fonts\/LinBiolinum_R[BI]?\.otf'\)/)
      expect(face).toContain('font-display: block')
    }
    expect(faces.map((face) => /font-weight: (\d+)/.exec(face)?.[1])).toEqual(['400', '700', '400'])
    expect(faces[2]).toContain('font-style: italic')
  })

  it('puts Linux Biolinum first in --font-sans and never maps a monospace family', () => {
    expect(theme).toMatch(/--font-sans:\s*'Linux Biolinum'/)
    expect(theme).toMatch(/--font-mono:\s*'Linux Biolinum'/)
    expect(css).not.toMatch(/Menlo|Consolas|ui-monospace|SF Mono/)
  })

  it('maps Tailwind weights onto the two real faces (500 and 600 must never mean something else)', () => {
    expect(theme).toContain('--font-weight-medium: 400;')
    expect(theme).toContain('--font-weight-semibold: 700;')
    expect(theme).toContain('--font-weight-bold: 700;')
  })

  it('drops the Inter-only font features, the pulse animation and uppercase transforms', () => {
    expect(css).not.toContain("'cv11'")
    expect(css).not.toContain('pulse-soft')
    expect(css).not.toMatch(/text-transform:\s*uppercase/)
  })
})

describe('native window ground', () => {
  const main = readFileSync(resolve(__dirname, '../../../main/windows/mainWindow.ts'), 'utf8')
  const declared = /WINDOW_BACKGROUND = \{ light: '(#[0-9a-f]{6})', dark: '(#[0-9a-f]{6})' \}/.exec(
    main
  )

  it('WINDOW_BACKGROUND equals --background (= --paper) in both themes, so launch never flashes', () => {
    expect(declared).not.toBeNull()
    expect(declared?.[1]).toBe(tokenHex('background', tables.light))
    expect(declared?.[2]).toBe(tokenHex('background', tables.dark))
  })
})

/**
 * Only Regular 400 and Bold 700 exist. Bold is rationed (DESIGN.md 4.3): the next event on the
 * Calendar, the one habit still to do today. Everything else is Regular, so `font-bold`,
 * `font-semibold` and a literal 600/700 weight are banned outside the allow-list. Every page is
 * migrated, so there is no pending list any more: a new bold use outside the allow-list fails.
 */
describe('bold is rationed', () => {
  const BOLD = /font-bold|font-semibold|font-weight:\s*[67]/
  const ALLOWED = ['CalendarBoard', 'TodayPanel', 'HabitCard', 'calendar.css']
  const files = sourceFiles(SRC).filter(
    (file) => !relative(SRC, file).endsWith('styles/globals.css') && !/\.test\.tsx?$/.test(file)
  )
  const offenders = files
    .filter((file) => BOLD.test(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file))
    .filter((file) => !ALLOWED.some((name) => file.includes(name)))

  it('no file outside the allow-list uses a bold weight', () => {
    expect(offenders).toEqual([])
  })

  it('the allow-list entries still exist (a renamed file must not silently drop its allowance)', () => {
    for (const name of ALLOWED)
      expect(
        files.some((file) => file.includes(name)),
        `${name} not found`
      ).toBe(true)
  })
})

describe('text controls keep a 28 px hit box (DESIGN.md 3.2)', () => {
  // A 22 px line plus padding-block p and margin-block -p: the box grows, the layout does not move.
  const utilityBody = (name: string): string => {
    const start = css.indexOf(`@utility ${name} {`)
    expect(start, `@utility ${name} exists`).toBeGreaterThan(-1)
    return css.slice(start, css.indexOf('\n}', start))
  }
  it.each([
    ['link', 5],
    ['link-quiet', 5],
    ['hit-28', 3]
  ])('%s pads its block axis by %ipx and cancels it with the margin', (name, px) => {
    const body = utilityBody(name)
    expect(body).toContain(`padding-block: ${px}px;`)
    expect(body).toContain(`margin-block: -${px}px;`)
  })
})
