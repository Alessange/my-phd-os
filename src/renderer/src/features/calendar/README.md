# Calendar feature

Spec §9–§10. Pure logic lives in `src/shared/ics` (`parse.ts`, `duplicates.ts`, `serialize.ts`) and
`src/shared/dates`; the main process owns files and dialogs (`src/main/filesystem/icsFiles.ts`,
`icsImport.ts`) and `handlers/calendar.ts`. All are unit/integration tested
(`src/shared/ics/ics.test.ts`, `tests/integration/icsImport.test.ts`).

- `api.ts`: events (by range), sources, event CRUD, source CRUD, pick/preview/commit import, export.
- `lib/occurrences.ts`: expands recurring events (RRULE, RDATE, EXDATE, modified instances) in
  wall-clock terms with DST-correct zone handling; feeds FullCalendar and the Today panel alike.
- `lib/fcEvents.ts`: filters (sources, categories, hidden sources) and FullCalendar event mapping
  (`editable` only for non-recurring, non source-managed events; colours from category/source).
- `lib/recurrence.ts`: presets ↔ RRULE drafts, validation, human description.
- `lib/dropFiles.ts`, `lib/navigation.ts`: drag-and-drop file reading; prev/next date stepping.
- `components/CalendarBoard.tsx`: FullCalendar wrapper (month / week / day / list, Luxon zone,
  week start, 12/24 h, select-to-create, click-to-open, drag/resize for editable events).
- `components/EventForm.tsx`: title, all-day, start/end date + time, per-event timezone, category,
  repeat preset / ends / raw RRULE, location, link, description; delete with confirmation.
- `components/EventDetails.tsx`: sheet with zoned times, recurrence text, source, links; edit /
  delete, or "Remove from calendar" for source-managed conference events.
- `components/IcsImportDialog.tsx`: file pick or dropped files → preview grouped by status (new /
  duplicate / conflict / invalid) with skip / replace / keep-both, target source → commit summary.
- `components/ExportIcsDialog.tsx`: all events, one source, or the visible range.
- `components/FiltersPopover.tsx`: sources (show/hide, colour, rename, delete) and categories.
- `components/TodayPanel.tsx`: today's events, the active event, the next event and its countdown.
- `pages/CalendarPage.tsx`: header (weekday, date, live clock, zone, next event), view switch,
  prev / today / next, exact empty-state copy, right panel (Today, nearest personal deadline,
  nearest followed conference, today's habits), deep links `{ date, eventId }`, bus commands
  `import-ics`, `calendar-today`, `calendar:create`, `calendar:export`, `calendar:view`.
