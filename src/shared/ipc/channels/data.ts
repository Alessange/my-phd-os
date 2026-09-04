import { clearAllDataRequestSchema, commitBackupImportRequestSchema } from '../../schemas/app'
import { emptyRequestSchema } from '../../schemas/common'
import type { OkResponse } from '../../types/common'
import type {
  BackupExportResult,
  BackupImportPreview,
  BackupImportResult,
  StorageInfo
} from '../../types/data'
import { defineChannel } from '../defineChannel'

export const dataChannels = {
  'data:exportBackup': defineChannel<typeof emptyRequestSchema, BackupExportResult>(
    'data:exportBackup',
    emptyRequestSchema
  ),
  'data:previewBackupImport': defineChannel<typeof emptyRequestSchema, BackupImportPreview>(
    'data:previewBackupImport',
    emptyRequestSchema
  ),
  'data:commitBackupImport': defineChannel<
    typeof commitBackupImportRequestSchema,
    BackupImportResult
  >('data:commitBackupImport', commitBackupImportRequestSchema),
  'data:clearAllData': defineChannel<typeof clearAllDataRequestSchema, OkResponse>(
    'data:clearAllData',
    clearAllDataRequestSchema
  ),
  'data:getStorageInfo': defineChannel<typeof emptyRequestSchema, StorageInfo>(
    'data:getStorageInfo',
    emptyRequestSchema
  )
}
