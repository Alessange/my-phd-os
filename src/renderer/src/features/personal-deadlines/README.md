# Personal deadlines feature

Spec §13–§14. Pure logic lives in `src/shared/personal-deadlines`: `views.ts` (computed status per
deadline via the centralised rules, scope/attribute filters, six sort orders, tag collection,
nearest upcoming, summary counts) and `calendarLink.ts` (deadline → linked calendar event mapping
for all-day / exact modes). Both are unit-tested; the calendar-link handlers have an integration
test (`tests/integration/personalDeadlineLinks.test.ts`).

- `api.ts`: list/detail queries and create/update/delete/setProgress/link/unlink mutations.
- `components/PersonalDeadlineForm.tsx`: title, deadline date + exact time, per-deadline timezone
  (app zone by default; IANA, UTC offsets, AoE, PT), tracking start, category, priority, status,
  progress (slider + number), description, source URL, location, tags, linked milestone; delete
  with confirmation. Optional fields are cleared with `null` on update.
- `components/PersonalDeadlineCard.tsx` / `PersonalDeadlineList.tsx` / `PersonalDeadlineTimeline.tsx`:
  the three views; the timeline reuses `features/timeline/layout.ts`.
- `components/PersonalDeadlineDetails.tsx`: drawer with large countdown, dual progress + pace,
  progress editing, all fields, linked milestone (→ Timeline) and calendar linking (add all-day /
  exact, open in Calendar, unlink keeping or removing the event).
- `components/PersonalDeadlinesTab.tsx`: view switch persisted in `ui.personalDeadlinesView`,
  filters, sorting, deep links `{ tab: 'personal', id }` and `{ tab: 'personal', create }`,
  quick-create over the command bus.
- `components/PersonalDeadlineCompact.tsx`: nearest upcoming deadline for the Calendar panel.
- `features/deadlines-summary/DeadlineSummary.tsx`: spec §14 summary (hidden on a fresh install).

Main process: `ipc/handlers/personalDeadlines.ts` links/unlinks calendar events, keeps a linked
event in sync when the deadline changes (never duplicates) and removes it when the deadline is
deleted. Calendar navigation from a deadline uses `navigate('calendar', { date, eventId })`; the
Calendar feature reads those params.
