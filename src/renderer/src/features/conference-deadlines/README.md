# Conference deadlines feature

Spec §12, simplified on the owner's request (2026-09-05): the tab shows **only the conferences
you chose**, as bars with big countdowns; the CCF Deadlines feed is a lookup source behind
"Add conference". Pure logic lives in `src/shared/conferences` (`buildSubscriptionUrl.ts`,
`parseConferenceFeed.ts`, `stableKey.ts`, `compareSnapshots.ts`, `calendarEvent.ts`, `views.ts`:
search, sort, round grouping, nearest followed, followed time-elapsed, urgency level, one-line
subline, change text). Main-process fetch / refresh / scheduler / calendar sync are in
`src/main/subscriptions/` (see `tests/integration/subscriptions.test.ts`).

Renderer:

- `api.ts`: subscriptions, refresh status (kept live by the `conferences:refreshStatus` push),
  deadlines (all cached), followed, one by id, changes; mutations for add/update/remove
  subscription, refresh, follow/unfollow/update follow, add to / remove from calendar, acknowledge.
- `components/ConferenceDeadlinesTab.tsx`: the board of followed conferences (passed ones behind
  a switch), "Add conference", the change banner for followed conferences, a one-line status with
  Refresh / Sources. Quick-create and `{ create }` open the picker; `{ id }` opens the sheet (also
  for a conference that is not followed, fetched by id).
- `components/ConferenceBoard.tsx`: months axis (one 9 px dot per deadline, names alternating above
  and below the line), then hairline rows under one ink rule. The first upcoming dated conference
  leads (28 px title, 64 px countdown, Local and Original times); the others show title, ranks,
  local date and a 28 px countdown. A 2 px line on the row's lower edge is the time gone since it
  was added (`deadlineProgress`, `role=progressbar`, "N% of the way there" in the lead row and
  sr-only elsewhere). The original-timezone line is in the DOM on every row and appears on hover
  and focus. No per-conference colour: rows differ by name and position.
- `components/DeadlineCountdown.tsx`: `9 d 09 h` / `09 h 29 m 49 s` (seconds only under 24 h; the
  hero size turns signal there) / `Passed 2 days ago` / `TBD`. Also used by the Personal list and
  the Calendar panel compacts.
- `components/ConferencePicker.tsx`: search over the cached list, Add / Remove per row, show
  passed, refresh; one-click "Load list" (English / 简体中文) when no source exists yet; link to the
  advanced builder.
- `components/ConferenceSheet.tsx`: details sheet wrapping `ConferenceCard` (compact header) with
  follow / calendar actions and `FollowDialog` (intention, progress, notes).
- `components/SubscriptionBuilder.tsx` / `SubscriptionManager.tsx`: advanced feed options
  (filtered official feeds, custom URL with trust confirmation) and the list in Settings.
- `components/ConferenceChangesBanner.tsx`, `FollowedConferenceCompact.tsx` (Calendar panel),
  `commands.ts` (Add conference, Go to Conference Deadlines, Refresh).

Canonical dates and metadata are never editable (spec §12.3); a feed request carries only the URL.
