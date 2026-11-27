import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { COLOUR_SWATCHES } from '@renderer/lib/colourSwatches'
import { ColourSwatchPicker } from './ColourSwatchPicker'

/** OKLCH hue in degrees of a `#rrggbb` colour. */
const oklchHue = (hex: string): number => {
  const lin = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = [lin(1), lin(3), lin(5)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
}

describe('COLOUR_SWATCHES', () => {
  it('starts with the default blue and has no duplicates', () => {
    expect(COLOUR_SWATCHES[0]).toBe('#3b82f6')
    expect(new Set(COLOUR_SWATCHES).size).toBe(COLOUR_SWATCHES.length)
  })

  it('keeps every pair of hues at least 30 degrees apart once normalised to one chroma', () => {
    for (let i = 0; i < COLOUR_SWATCHES.length; i++) {
      for (let j = i + 1; j < COLOUR_SWATCHES.length; j++) {
        const d = Math.abs(oklchHue(COLOUR_SWATCHES[i]) - oklchHue(COLOUR_SWATCHES[j]))
        expect(
          Math.min(d, 360 - d),
          `${COLOUR_SWATCHES[i]} vs ${COLOUR_SWATCHES[j]}`
        ).toBeGreaterThanOrEqual(30)
      }
    }
  })
})

describe('ColourSwatchPicker', () => {
  it('marks the current swatch pressed and reports a pick', async () => {
    const onChange = vi.fn()
    render(<ColourSwatchPicker value="#EF4444" onChange={onChange} label="Source colour" />)
    expect(screen.getByRole('group', { name: 'Source colour' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Colour #ef4444' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Colour #3b82f6' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Colour #84cc16' }))
    expect(onChange).toHaveBeenCalledWith('#84cc16')
  })
})
