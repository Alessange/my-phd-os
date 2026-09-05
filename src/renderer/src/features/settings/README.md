# Settings feature

Spec §17. General, Conference Subscriptions (shell from the conferences feature), Data and About
sections; `pages/SettingsPage.tsx` provides the in-page section nav and `{ section }` deep link.

- `api.ts`: `useStorageInfo`, `useOpenDataDirectory`, `useExportBackup`, `usePreviewBackupImport`,
  `useCommitBackupImport`, `useClearAllData`, `useExportCalendar`.
- `components/DataSection.tsx`: database location/size/counts, JSON backup export and import with a
  mandatory preview (merge / replace), calendar export, clear-all behind a typed second confirmation.
  Palette commands `settings:export-backup` / `settings:import-backup` start these flows over the bus.
- Backup format and validation: `src/shared/backup` (`format.ts`, `validate.ts`); file I/O and the
  atomic import: `src/main/filesystem/backup.ts`; handlers: `src/main/ipc/handlers/data.ts`.

Left for integration: `calendar:exportIcs` is still a stub in main (calendar feature).
