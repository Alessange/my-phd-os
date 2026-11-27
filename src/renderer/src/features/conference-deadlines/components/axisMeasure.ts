import { useEffect, useState } from 'react'

/** Horizontal padding of one axis name (`pl-0.5` + `pr-0.5`), counted in its width. */
const LABEL_PADDING = 4
/** The 13 px `text-meta` size the axis names are set in. */
const LABEL_FONT_SIZE = 13

let context: CanvasRenderingContext2D | null | undefined

const canvasContext = (): CanvasRenderingContext2D | null => {
  if (context !== undefined) return context
  // jsdom has no canvas (and logs "not implemented" when asked for one): use the estimate there.
  const headless = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
  try {
    context = headless ? null : document.createElement('canvas').getContext('2d')
  } catch {
    context = null
  }
  return context
}

/** Pixel width of an axis name in the app's real typeface (an estimate where there is no canvas). */
export function measureAxisLabel(text: string): number {
  const ctx = canvasContext()
  if (!ctx) return Math.ceil(text.length * 6.6) + LABEL_PADDING
  ctx.font = `${LABEL_FONT_SIZE}px ${getComputedStyle(document.body).fontFamily}`
  return Math.ceil(ctx.measureText(text).width) + LABEL_PADDING
}

/** Width of an element in CSS pixels, kept current while it resizes; `fallback` until measured. */
export function useElementWidth(element: HTMLElement | null, fallback = 960): number {
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    // An observer reports the element's size as soon as it starts observing, then on every resize.
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0)
      if (next > 0) setWidth(next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return width
}

/** Bumps once the web fonts have loaded, so names measured with a fallback face are measured again. */
export function useFontsLoaded(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let live = true
    void document.fonts?.ready.then(() => {
      if (live) setVersion((v) => v + 1)
    })
    return () => {
      live = false
    }
  }, [])
  return version
}
