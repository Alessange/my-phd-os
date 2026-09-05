import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyCounts } from '@shared/backup/format'
import type { StorageInfo } from '@shared/types/data'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { windowApi } from '../../../../../../tests/setup/renderer'
import { DataSection } from './DataSection'

const counts = { ...emptyCounts(), personalDeadlines: 2, habits: 1 }
const STORAGE: StorageInfo = {
  databasePath: '/tmp/my-phd-os-test/my-phd-os.sqlite',
  databaseSizeBytes: 2048,
  userDataPath: '/tmp/my-phd-os-test',
  logPath: '/tmp/my-phd-os-test/logs/main.log',
  counts
}

const user = userEvent.setup({ pointerEventsCheck: 0 })

describe('DataSection', () => {
  beforeEach(() => {
    windowApi.respond('data:getStorageInfo', STORAGE)
    windowApi.respond('app:openDataDirectory', { ok: true })
    windowApi.respond('data:exportBackup', { canceled: false, path: '/tmp/backup.json', counts })
    windowApi.respond('data:previewBackupImport', {
      canceled: false,
      previewToken: 't1',
      summary: {
        formatVersion: 1,
        exportedAt: '2026-09-05T10:00:00.000Z',
        appVersion: '0.1.0',
        counts,
        warnings: ['Ignored unknown table "app_meta" (2 rows)']
      }
    })
    windowApi.respond('data:commitBackupImport', { imported: counts })
    windowApi.respond('data:clearAllData', { ok: true })
  })

  it('shows where the database lives, its size and what it holds', async () => {
    renderWithProviders(<DataSection />)
    expect(await screen.findByText('/tmp/my-phd-os-test/my-phd-os.sqlite')).toBeInTheDocument()
    expect(screen.getByTestId('storage-summary')).toHaveTextContent(
      '2.0 KB · 2 personal deadlines, 1 habits'
    )
  })

  it('exports a backup through the native save dialog channel', async () => {
    renderWithProviders(<DataSection />)
    await user.click(await screen.findByRole('button', { name: 'Export backup…' }))
    await waitFor(() => expect(windowApi.invoke).toHaveBeenCalledWith('data:exportBackup'))
  })

  it('previews an import, shows its contents and warnings, then commits with the chosen mode', async () => {
    renderWithProviders(<DataSection />)
    await user.click(await screen.findByRole('button', { name: 'Import backup…' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('import-contains')).toHaveTextContent(
      '2 personal deadlines, 1 habits'
    )
    expect(within(dialog).getByText(/Ignored unknown table/)).toBeInTheDocument()
    expect(windowApi.invoke).not.toHaveBeenCalledWith('data:commitBackupImport', expect.anything())
    await user.click(within(dialog).getByRole('radio', { name: 'Replace everything' }))
    await user.click(within(dialog).getByRole('button', { name: 'Replace and import' }))
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('data:commitBackupImport', {
        previewToken: 't1',
        mode: 'replace'
      })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('clears all data only after the exact confirmation phrase is typed', async () => {
    renderWithProviders(<DataSection />)
    await user.click(await screen.findByRole('button', { name: 'Clear all data…' }))
    const confirm = await screen.findByRole('alertdialog')
    const action = within(confirm).getByRole('button', { name: 'Delete everything' })
    expect(action).toBeDisabled()
    await user.type(within(confirm).getByLabelText(/Type/), 'DELETE ALL DATA')
    expect(action).toBeEnabled()
    await user.click(action)
    await waitFor(() =>
      expect(windowApi.invoke).toHaveBeenCalledWith('data:clearAllData', {
        confirmation: 'DELETE ALL DATA'
      })
    )
  })
})
