import type { DataCounts, DialogResult, IsoInstant } from './common'

export type BackupExportResult = DialogResult<{ path: string; counts: DataCounts }>

export interface BackupImportSummary {
  formatVersion: number
  exportedAt: IsoInstant
  appVersion: string
  counts: DataCounts
  warnings: string[]
}

export type BackupImportPreview = DialogResult<{
  previewToken: string
  summary: BackupImportSummary
}>

export const BACKUP_IMPORT_MODES = ['replace', 'merge'] as const
export type BackupImportMode = (typeof BACKUP_IMPORT_MODES)[number]

export interface BackupImportResult {
  imported: DataCounts
}

export const CLEAR_ALL_DATA_CONFIRMATION = 'DELETE ALL DATA' as const

export interface StorageInfo {
  databasePath: string
  databaseSizeBytes: number
  userDataPath: string
  logPath: string
  counts: DataCounts
}
