/**
 * The one preset palette for per-record colours (habits, calendar sources). Every swatch is painted
 * through `userColor`, which keeps only the hue at the design's shared lightness and chroma, so the
 * presets are spaced at least 30 degrees apart in OKLCH hue (guarded by a test) to stay tellable
 * apart. The default (blue) comes first. Stored values are never rewritten.
 */
export const COLOUR_SWATCHES = [
  '#3b82f6',
  '#ef4444',
  '#f59e0b',
  '#84cc16',
  '#14b8a6',
  '#06b6d4',
  '#a855f7',
  '#ec4899'
] as const
