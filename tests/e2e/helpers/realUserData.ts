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
 * Recursive listing of a directory as `relativePath size mtimeMs` lines (sorted). A missing
 * directory yields `['<missing>']`, so "still missing" also compares equal.
 */
export const snapshotDirectory = (root: string): string[] => {
  if (!existsSync(root)) return ['<missing>']
  const lines: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      const stat = statSync(full)
      lines.push(
        `${relative(root, full)} ${entry.isDirectory() ? 'dir' : stat.size} ${stat.mtimeMs}`
      )
      if (entry.isDirectory()) walk(full)
    }
  }
  walk(root)
  const rootStat = statSync(root)
  lines.push(`. dir ${rootStat.mtimeMs}`)
  return lines.sort()
}
