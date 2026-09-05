import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative } from 'node:path'

/**
 * Where an unpackaged Electron build of this app would put `userData` when nothing overrides it
 * (`app.getName()` is the package name, `my-phd-os`). E2E runs must never write there.
 */
export const realUserDataDir = (): string => {
  const name = 'my-phd-os'
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', name)
  if (process.platform === 'win32')
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), name)
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), name)
}

/** Chromium's single-instance lock exists only while an app is running with this `userData`. */
export const isRealAppRunning = (root: string): boolean => {
  try {
    lstatSync(join(root, 'SingletonLock'))
    return true
  } catch {
    return false
  }
}

/**
 * Directories Chromium / Electron rewrite on their own while an installed copy of the app is
 * open. They are listed by name only and not walked, so a live instance next to the suite does
 * not make the comparison noisy; a leak from e2e would still show up as a new database, settings
 * document or changed database size.
 */
const VOLATILE_DIRS = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Shared Dictionary',
  'Session Storage',
  'Local Storage',
  'blob_storage',
  'logs'
])

/** Files a running instance touches that say nothing about e2e leaks (listed by name only). */
const isVolatileFile = (name: string): boolean =>
  name.startsWith('Singleton') ||
  name === 'DevToolsActivePort' ||
  name.startsWith('DIPS') ||
  name === 'Local State' ||
  name === 'Preferences' ||
  name === 'Network Persistent State' ||
  name.startsWith('Trust Tokens') ||
  name.startsWith('declarative_performance_observer') ||
  name.endsWith('-wal') ||
  name.endsWith('-shm') ||
  name.endsWith('-journal')

/**
 * Recursive listing of a directory (sorted): every entry by relative path, plus `size mtimeMs`
 * for the files that matter (the database and any settings / backup files). Uses `lstat`, so a
 * dangling symlink such as Chromium's `SingletonCookie` never throws. A missing directory yields
 * `['<missing>']`, so "still missing" also compares equal.
 */
export const snapshotDirectory = (root: string): string[] => {
  if (!existsSync(root)) return ['<missing>']
  const lines: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      const rel = relative(root, full)
      if (entry.isDirectory()) {
        lines.push(`${rel} dir`)
        if (!VOLATILE_DIRS.has(entry.name)) walk(full)
      } else if (entry.isSymbolicLink() || isVolatileFile(entry.name)) {
        lines.push(`${rel} volatile`)
      } else {
        const stat = lstatSync(full)
        lines.push(`${rel} ${stat.size} ${stat.mtimeMs}`)
      }
    }
  }
  walk(root)
  return lines.sort()
}
