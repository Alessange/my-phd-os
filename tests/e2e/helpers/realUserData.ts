import { existsSync, readdirSync, statSync } from 'node:fs'
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

/**
 * Recursive listing of a directory (sorted): every entry by relative path, plus `size mtimeMs`
 * for files outside `logs/`. Directory mtimes and the log files are listed by name only, because
 * a real installed copy of the app running alongside the suite appends to `logs/main.log`; a leak
 * from e2e would still show up as a new database / settings file or a changed database size.
 * A missing directory yields `['<missing>']`, so "still missing" also compares equal.
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
        walk(full)
      } else if (rel.startsWith('logs/') || rel.startsWith('logs\\')) {
        lines.push(`${rel} log`)
      } else {
        const stat = statSync(full)
        lines.push(`${rel} ${stat.size} ${stat.mtimeMs}`)
      }
    }
  }
  walk(root)
  return lines.sort()
}
