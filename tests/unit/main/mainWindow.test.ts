import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: class {},
  nativeTheme: { shouldUseDarkColors: false },
  screen: { getAllDisplays: () => [] }
}))
vi.mock('../../../src/main/logging/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logAppError: vi.fn()
}))
vi.mock('../../../src/main/database/repositories/settings', () => ({
  getSettings: vi.fn(),
  getWindowState: vi.fn(),
  setWindowState: vi.fn()
}))

const {
  DEFAULT_WINDOW_SIZE,
  MIN_WINDOW_SIZE,
  WINDOW_BACKGROUND,
  backgroundColorFor,
  resolveInitialBounds
} = await import('../../../src/main/windows/mainWindow')

const laptop = { x: 0, y: 25, width: 1512, height: 957 }
const external = { x: 1512, y: -300, width: 2560, height: 1415 }

describe('resolveInitialBounds', () => {
  it('uses the default size, centred, when nothing was saved', () => {
    expect(resolveInitialBounds(undefined, [laptop])).toEqual({ ...DEFAULT_WINDOW_SIZE })
  })

  it('restores a saved position that still overlaps a display by ≥ 64 px on both axes', () => {
    const saved = { x: 100, y: 80, width: 1200, height: 800, isMaximized: false }
    expect(resolveInitialBounds(saved, [laptop])).toEqual({
      x: 100,
      y: 80,
      width: 1200,
      height: 800
    })
    // Mostly off-screen to the right but still 64 px visible on the external display.
    const edge = { x: 1512 + 2560 - 64, y: 0, width: 1000, height: 700, isMaximized: false }
    expect(resolveInitialBounds(edge, [laptop, external])).toMatchObject({ x: edge.x, y: 0 })
  })

  it('drops a position that no longer overlaps any display (monitor unplugged)', () => {
    const saved = { x: 3000, y: 100, width: 1200, height: 800, isMaximized: false }
    expect(resolveInitialBounds(saved, [laptop])).toEqual({ width: 1200, height: 800 })
    const barely = { x: 1512 - 63, y: 100, width: 1200, height: 800, isMaximized: false }
    expect(resolveInitialBounds(barely, [laptop])).toEqual({ width: 1200, height: 800 })
  })

  it('clamps the size to the minimum and to the largest work area', () => {
    const tiny = { x: 10, y: 30, width: 300, height: 200, isMaximized: false }
    expect(resolveInitialBounds(tiny, [laptop])).toEqual({ x: 10, y: 30, ...MIN_WINDOW_SIZE })
    const huge = { width: 9000, height: 9000, isMaximized: true }
    expect(resolveInitialBounds(huge, [laptop, external])).toEqual({
      width: external.width,
      height: external.height
    })
  })

  it('falls back to the default size without any display information', () => {
    expect(resolveInitialBounds({ width: 1000, height: 700, isMaximized: false }, [])).toEqual({
      width: 1000,
      height: 700
    })
  })
})

describe('backgroundColorFor', () => {
  it('paints the persisted theme; system follows the OS', () => {
    expect(backgroundColorFor('dark', false)).toBe(WINDOW_BACKGROUND.dark)
    expect(backgroundColorFor('light', true)).toBe(WINDOW_BACKGROUND.light)
    expect(backgroundColorFor('system', true)).toBe(WINDOW_BACKGROUND.dark)
    expect(backgroundColorFor('system', false)).toBe(WINDOW_BACKGROUND.light)
  })
})
