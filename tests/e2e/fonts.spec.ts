import { expect, test } from '@playwright/test'
import { launchApp, waitForShell, type LaunchedApp } from './helpers/launchApp'

/**
 * Typeface (Decision 68): Linux Biolinum is bundled. The owner's machine also has it installed
 * system-wide, which would hide a broken `@font-face`, so this asserts on the `FontFace` objects
 * (status `loaded`, i.e. fetched from the bundled files) and on the resource requests, not on how
 * text happens to render.
 */

let launched: LaunchedApp

test.beforeAll(async () => {
  launched = await launchApp()
  await waitForShell(launched.page)
})

test.afterAll(async () => {
  await launched?.close()
})

test('the three bundled Linux Biolinum faces load and the body uses them', async () => {
  const { page } = launched
  const faces = await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('15px "Linux Biolinum"'),
      document.fonts.load('700 15px "Linux Biolinum"'),
      document.fonts.load('italic 15px "Linux Biolinum"')
    ])
    return [...document.fonts]
      .filter((face) => face.family.replace(/["']/g, '') === 'Linux Biolinum')
      .map((face) => ({ weight: face.weight, style: face.style, status: face.status }))
  })
  expect(faces).toEqual([
    { weight: '400', style: 'normal', status: 'loaded' },
    { weight: '700', style: 'normal', status: 'loaded' },
    { weight: '400', style: 'italic', status: 'loaded' }
  ])

  const bodyFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  expect(bodyFamily.startsWith('"Linux Biolinum"')).toBe(true)
})

test('the font sources are bundled files, with no CSP violation and no monospace text', async () => {
  const { page, consoleMessages, pageErrors } = launched
  // Resource Timing does not report file:// loads, so read the declared sources instead: every face
  // points at a hashed file emitted next to the CSS in assets/ (a missing or wrongly-hashed file fails `loaded` above).
  const sources = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
      .filter((rule) => rule.style.getPropertyValue('font-family').includes('Linux Biolinum'))
      .map((rule) => /url\("?([^")]+)"?\)/.exec(rule.style.getPropertyValue('src'))?.[1] ?? '')
  )
  expect(sources).toHaveLength(3)
  for (const source of sources) expect(source).toMatch(/LinBiolinum_R[BI]?-[\w-]+\.otf$/)

  const monospace = await page.evaluate(
    () =>
      [...document.querySelectorAll('body *')].filter((element) => {
        const family = getComputedStyle(element).fontFamily
        return /monospace|menlo|consolas|sf mono/i.test(family)
      }).length
  )
  expect(monospace).toBe(0)

  const violations = consoleMessages.filter((line) =>
    /content security policy|refused to (load|execute|apply|connect)|failed to (load|decode)/i.test(
      line.text
    )
  )
  expect(violations).toEqual([])
  expect(pageErrors).toEqual([])
})
