import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, type BrowserWindow } from 'electron'
import { AppError } from '@shared/errors'
import type { DialogResult } from '@shared/types/common'
import type { IcsFileInput, IcsPickResult } from '@shared/types/calendar'
import { pickFiles, pickSavePath } from './dialogs'

const ICS_FILTERS = [{ name: 'iCalendar', extensions: ['ics', 'ical', 'icalendar', 'ifb'] }]
/** Matches `icsFileInputSchema`; a bigger file is refused before it is parsed. */
const MAX_ICS_BYTES = 50 * 1024 * 1024

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Reads one `.ics` file chosen through the native dialog; only its name and text cross the bridge. */
export const readIcsFile = (path: string): IcsFileInput => {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    throw new AppError('IO', `Could not read "${basename(path)}": ${reason(error)}`, { path })
  }
  if (text.length > MAX_ICS_BYTES) {
    throw new AppError('IO', `"${basename(path)}" is larger than 50 MB`, { path })
  }
  return { name: basename(path), text }
}

/** Native multi-select open dialog for `.ics` files. Cancel is a value, never an error. */
export const pickIcsFiles = async (window: BrowserWindow | null): Promise<IcsPickResult> => {
  const picked = await pickFiles(window, {
    title: 'Import .ics files',
    filters: ICS_FILTERS,
    multiple: true
  })
  if (picked.canceled) return { canceled: true }
  return { canceled: false, files: picked.paths.map(readIcsFile) }
}

/** Native save dialog + atomic write (temp file, then rename). */
export const saveIcsFile = async (
  window: BrowserWindow | null,
  suggestedName: string,
  text: string
): Promise<DialogResult<{ path: string }>> => {
  const picked = await pickSavePath(window, {
    title: 'Export calendar (.ics)',
    filters: ICS_FILTERS,
    defaultPath: join(app.getPath('documents'), suggestedName)
  })
  if (picked.canceled) return { canceled: true }
  const tmp = `${picked.path}.tmp-${randomUUID().slice(0, 8)}`
  try {
    writeFileSync(tmp, text, 'utf8')
    renameSync(tmp, picked.path)
  } catch (error) {
    throw new AppError('IO', `Could not write the .ics file: ${reason(error)}`, {
      path: picked.path
    })
  }
  return { canceled: false, path: picked.path }
}
