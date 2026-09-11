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
- `components/ConferenceBoard.tsx`: months axis with a dot per deadline, then one row per
  conference: a colour stripe, dot, title + subline (ranks / abstract / round), a bar that fills
  from the day it was added to its deadline (`deadlineProgress`), the dates, and
  `DeadlineCountdown`. Each
  conference owns a palette colour (`assignConferenceColors`, stable across reordering); urgency
  shows through the countdown and a ring, not the colour.
- `components/DeadlineCountdown.tsx`: `32 d` / `08h 14m` (seconds, red, under 24 h) / `Passed` /
  `TBD`.
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
