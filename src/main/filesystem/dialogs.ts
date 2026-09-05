import { dialog, type BrowserWindow, type FileFilter } from 'electron'
import type { DialogResult } from '@shared/types/common'

export interface OpenFilesOptions {
  title: string
  filters: FileFilter[]
  multiple?: boolean
  defaultPath?: string
}

export interface SaveFileOptions {
  title: string
  filters: FileFilter[]
  defaultPath?: string
}

const parentOf = (window: BrowserWindow | null): BrowserWindow | undefined =>
  window && !window.isDestroyed() ? window : undefined

/** Native open dialog. Cancel is a value (`{ canceled: true }`), never an error. */
export const pickFiles = async (
  window: BrowserWindow | null,
  options: OpenFilesOptions
): Promise<DialogResult<{ paths: string[] }>> => {
  const properties: Array<'openFile' | 'multiSelections'> = ['openFile']
  if (options.multiple) properties.push('multiSelections')
  const dialogOptions = {
    title: options.title,
    filters: options.filters,
    defaultPath: options.defaultPath,
    properties
  }
  const parent = parentOf(window)
  const result = parent
    ? await dialog.showOpenDialog(parent, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions)
  if (result.canceled || result.filePaths.length === 0) return { canceled: true }
  return { canceled: false, paths: result.filePaths }
}

/** Native save dialog. Cancel is a value (`{ canceled: true }`), never an error. */
export const pickSavePath = async (
  window: BrowserWindow | null,
  options: SaveFileOptions
): Promise<DialogResult<{ path: string }>> => {
  const dialogOptions = {
    title: options.title,
    filters: options.filters,
    defaultPath: options.defaultPath
  }
  const parent = parentOf(window)
  const result = parent
    ? await dialog.showSaveDialog(parent, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions)
  if (result.canceled || !result.filePath) return { canceled: true }
  return { canceled: false, path: result.filePath }
}
