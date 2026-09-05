import type { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { BrowserWindow, screen, type Rectangle } from 'electron'
import { getWindowState, setWindowState, type WindowState } from '../database/repositories/settings'
import { logAppError, logger } from '../logging/logger'

export const DEFAULT_WINDOW_SIZE = { width: 1440, height: 900 } as const
export const MIN_WINDOW_SIZE = { width: 960, height: 640 } as const
const PERSIST_DEBOUNCE_MS = 300
/** A restored window must overlap a display by at least this much on both axes. */
const MIN_VISIBLE_PX = 64

export interface MainWindowOptions {
  db: DatabaseSync | null
  /** Vite dev-server URL; when absent the bundled `out/renderer/index.html` is loaded. */
  rendererUrl?: string
  rendererIndex: string
  /** Adds `?dbError=1` so the renderer shows the blocking database error screen. */
  dbError: boolean
  icon?: string
}

const intersects = (a: Rectangle, b: Rectangle): boolean =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) >= MIN_VISIBLE_PX &&
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) >= MIN_VISIBLE_PX

/**
 * Turns a saved state into bounds that are guaranteed visible: size is clamped to the minimum and
 * to the largest work area; a position that no longer overlaps any display is dropped (centred).
 */
export const resolveInitialBounds = (
  saved: WindowState | undefined,
  workAreas: Rectangle[]
): Partial<Rectangle> & { width: number; height: number } => {
  const largest = workAreas.reduce<Rectangle | undefined>(
    (best, area) => (!best || area.width * area.height > best.width * best.height ? area : best),
    undefined
  )
  const maxWidth = largest?.width ?? Number.POSITIVE_INFINITY
  const maxHeight = largest?.height ?? Number.POSITIVE_INFINITY
  const width = Math.min(
    Math.max(saved?.width ?? DEFAULT_WINDOW_SIZE.width, MIN_WINDOW_SIZE.width),
    maxWidth
  )
  const height = Math.min(
    Math.max(saved?.height ?? DEFAULT_WINDOW_SIZE.height, MIN_WINDOW_SIZE.height),
    maxHeight
  )
  if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
    const candidate = { x: saved.x, y: saved.y, width, height }
    if (workAreas.some((area) => intersects(candidate, area))) return candidate
  }
  return { width, height }
}

const readSavedState = (db: DatabaseSync | null): WindowState | undefined => {
  if (!db) return undefined
  try {
    return getWindowState(db)
  } catch (error) {
    logAppError('window.restore', error)
    return undefined
  }
}

export const createMainWindow = (options: MainWindowOptions): BrowserWindow => {
  const saved = readSavedState(options.db)
  const bounds = resolveInitialBounds(
    saved,
    screen.getAllDisplays().map((display) => display.workArea)
  )
  const isMac = process.platform === 'darwin'

  const window = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    show: false,
    title: 'My PhD OS',
    backgroundColor: '#0f172a',
    autoHideMenuBar: !isMac,
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 18 } }
      : {}),
    ...(options.icon && process.platform === 'linux' ? { icon: options.icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: true
    }
  })

  if (saved?.isMaximized) window.maximize()
  window.once('ready-to-show', () => window.show())
  attachStatePersistence(window, options.db)

  if (options.rendererUrl) {
    const url = new URL(options.rendererUrl)
    if (options.dbError) url.searchParams.set('dbError', '1')
    void window.loadURL(url.href)
  } else {
    void window.loadFile(
      options.rendererIndex,
      options.dbError ? { query: { dbError: '1' } } : undefined
    )
  }
  return window
}

/** Persists bounds + maximised flag (debounced) so the next launch restores them. */
const attachStatePersistence = (window: BrowserWindow, db: DatabaseSync | null): void => {
  if (!db) return
  let timer: ReturnType<typeof setTimeout> | null = null

  const save = (): void => {
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return
    const normal = window.getNormalBounds()
    try {
      setWindowState(db, {
        x: normal.x,
        y: normal.y,
        width: normal.width,
        height: normal.height,
        isMaximized: window.isMaximized()
      })
    } catch (error) {
      logAppError('window.persist', error)
    }
  }
  const flush = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
    save()
  }
  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, PERSIST_DEBOUNCE_MS)
  }

  window.on('resize', schedule)
  window.on('move', schedule)
  window.on('maximize', flush)
  window.on('unmaximize', flush)
  window.on('close', flush)
  window.on('closed', () => {
    if (timer) clearTimeout(timer)
    logger.debug('[window] main window closed')
  })
}
