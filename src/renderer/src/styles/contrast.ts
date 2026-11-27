/**
 * WCAG 2 contrast maths for the design tokens, pure computation (no dependency). Understands the
 * subset of CSS the token blocks use: `oklch()`, `var(--x)`, and `color-mix(in oklab, A p%, B)`.
 * The same maths as any standard WCAG contrast checker, so the numbers agree with them.
 */

type Rgb = [number, number, number]
interface Colour {
  /** Linear-light sRGB. */
  lin: Rgb
  alpha: number
}

const toLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

const oklabToLin = ([L, a, b]: Rgb): Rgb => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ]
}

const linToOklab = ([r, g, b]: Rgb): Rgb => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}

const clip = (v: Rgb): Rgb => v.map((x) => Math.min(1, Math.max(0, x))) as Rgb

/** Declarations of one top-level block of the stylesheet (`:root`, `.dark`). */
export const declarations = (css: string, selector: string): Record<string, string> => {
  const start = css.indexOf(`${selector} {`)
  const body = css.slice(start, css.indexOf('\n}', start))
  const out: Record<string, string> = {}
  for (const match of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[match[1]] = match[2].replace(/\/\*.*?\*\//g, '').trim()
  }
  return out
}

export type ThemeName = 'light' | 'dark'

/** Token tables per theme; dark falls back to the light value for tokens it does not redefine. */
export const themeTokens = (css: string): Record<ThemeName, Record<string, string>> => {
  const light = declarations(css, ':root')
  return { light, dark: { ...light, ...declarations(css, '.dark') } }
}

/** Splits on commas outside parentheses. */
const splitTop = (text: string): string[] => {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else current += ch
  }
  if (current.trim()) parts.push(current)
  return parts.map((part) => part.trim()).filter(Boolean)
}

const over = (fg: Colour, bg: Colour): Colour => ({
  lin: fg.lin.map((c, i) => c * fg.alpha + bg.lin[i] * (1 - fg.alpha)) as Rgb,
  alpha: 1
})

const parseColour = (value: string, table: Record<string, string>): Colour => {
  const text = value.trim()
  let m: RegExpExecArray | null
  if ((m = /^var\(--([a-z0-9-]+)\)$/i.exec(text))) {
    const next = table[m[1]]
    if (next === undefined) throw new Error(`unknown token --${m[1]}`)
    return parseColour(next, table)
  }
  if ((m = /^#([0-9a-f]{6})$/i.exec(text))) {
    const hex = m[1]
    return {
      lin: [0, 2, 4].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255)) as Rgb,
      alpha: 1
    }
  }
  if (
    (m = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)$/i.exec(
      text
    ))
  ) {
    const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1])
    const C = parseFloat(m[2])
    const h = (parseFloat(m[3]) * Math.PI) / 180
    const alpha =
      m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return { lin: clip(oklabToLin([L, C * Math.cos(h), C * Math.sin(h)])), alpha }
  }
  if ((m = /^color-mix\(\s*in oklab\s*,(.*)\)$/i.exec(text))) {
    const [first, second] = splitTop(m[1])
    const pct = /^(.*?)\s+([\d.]+)%$/.exec(first)
    if (!pct || second === undefined) throw new Error(`unsupported color-mix "${text}"`)
    const a = parseColour(pct[1], table)
    const t = parseFloat(pct[2]) / 100
    if (second === 'transparent') return { lin: a.lin, alpha: a.alpha * t }
    const b = parseColour(second, table)
    const la = linToOklab(a.lin)
    const lb = linToOklab(b.lin)
    return {
      lin: clip(oklabToLin(la.map((x, i) => x * t + lb[i] * (1 - t)) as Rgb)),
      alpha: 1
    }
  }
  throw new Error(`unsupported colour "${text}"`)
}

/** `ink`, a token name; or `mix(ink,5,paper)` = ink at 5 % over paper (how overlays are painted). */
const side = (expr: string, table: Record<string, string>): Colour => {
  const mix = /^mix\(([a-z0-9-]+),\s*([\d.]+)\s*,\s*([a-z0-9-]+)\)$/i.exec(expr)
  if (mix) {
    const a = parseColour(`var(--${mix[1]})`, table)
    const b = parseColour(`var(--${mix[3]})`, table)
    const t = parseFloat(mix[2]) / 100
    const la = linToOklab(a.lin)
    const lb = linToOklab(b.lin)
    return {
      lin: clip(oklabToLin(la.map((x, i) => x * t + lb[i] * (1 - t)) as Rgb)),
      alpha: 1
    }
  }
  return parseColour(/^[a-z0-9-]+$/i.test(expr) ? `var(--${expr})` : expr, table)
}

const luminance = ({ lin: [r, g, b] }: Colour): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** WCAG contrast ratio of `fg` over `bg` (both are token names or `mix(token,pct,base)`). */
export const contrastRatio = (fg: string, bg: string, table: Record<string, string>): number => {
  const back = side(bg, table)
  const front = side(fg, table)
  const flattened = front.alpha < 1 ? over(front, back) : front
  const [hi, lo] = [luminance(flattened), luminance(back)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** sRGB hex of a token (`#fbfaf7`), used to compare with the native window background. */
export const tokenHex = (token: string, table: Record<string, string>): string => {
  const { lin } = parseColour(`var(--${token})`, table)
  return `#${clip(lin)
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

export interface ContrastPair {
  fg: string
  bg: string
  min: number
}

/** Parses `fg/bg:min,fg/bg:min` (mix() keeps its commas). */
export const parsePairs = (text: string): ContrastPair[] =>
  splitTop(text).map((pair) => {
    const colon = pair.lastIndexOf(':')
    const spec = pair.slice(0, colon)
    const slash = spec.indexOf('/')
    return {
      fg: spec.slice(0, slash),
      bg: spec.slice(slash + 1),
      min: parseFloat(pair.slice(colon + 1))
    }
  })
