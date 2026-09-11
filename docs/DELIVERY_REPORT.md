# My PhD OS — Delivery Report

Date: 2026-09-10 · Version 0.1.3 · 中文版: `docs/DELIVERY_REPORT.zh-CN.md` · Platform verified: macOS (Apple Silicon), Electron 44.2 /
Node 24 runtime. Spec: `prompt.md` §28. Contract and decisions: `docs/ARCHITECTURE.md` (decisions
1–67).

## 1. Pages implemented

| Page          | What works                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Calendar**  | Month / week / day / list views (FullCalendar 6.1), header with weekday, date, live clock, timezone and next event; create by selecting a slot, edit / delete, drag and resize (non-recurring, user-owned events only); per-event timezone; recurrence (presets, ends, raw RRULE) expanded DST-correctly with exceptions and modified instances; category and source filters; `.ics` import (dialog or drag-and-drop) with duplicate preview; `.ics` export; right panel: Today (current + next event with countdown), nearest personal deadline, nearest followed conference, today's habits; exact empty-state copy.                                                                                                                                                                                                                |
| **Deadlines** | Two tabs. **Conference**: a board of the conferences you chose — one row each in its own colour with a bar that fills from the day it was added to its deadline, the dates in the original and local timezone and a big countdown; a months axis above; details in a sheet (ranks, dates, location, homepage, intention / notes, add to or remove from calendar). _Add conference_ searches the CCF Deadlines list (one-click load of the official feed; filtered feeds and custom URLs behind an advanced link and in Settings). Upstream-change banner for chosen conferences. **Personal**: bar timeline by default, cards and list on request; filters and sorts; form with per-deadline zone; details drawer with dual time/work progress and pace; calendar linking. Summary strip keeps personal and conference figures apart. |
| **Timeline**  | Gantt (year / phase / range views) and list of milestones with lanes, today tick, time-vs-work fill, linked-deadline markers and a "Followed conferences" marker track (click opens the conference); milestone editor; seven timeline checks with dismissable warnings that deep-link to the offending item.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Habits**    | Daily / weekly habits with icon, target and reminder text; today's completion toggles; streaks and weekly progress; edit / delete with confirmation; compact "today" widget on the Calendar page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Settings**  | General (timezone, date format, clock, week start, theme, default calendar view, launch page), Conference Subscriptions (manager + automatic refresh interval, refresh on launch, request timeout), Data (path, storage info, JSON backup export / preview / import replace-or-merge, open data folder), About (versions, privacy statement, CCF Deadlines attribution).                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Shell: sidebar navigation, top bar with quick-create, command palette (`⌘K`), keyboard shortcuts,
light / dark / system theme, native application menu, toasts with retry, blocking database-error
screen with retry.

## 2. Desktop interactions

Native menu bar mirroring the palette commands; shortcuts (`⌘1–5` pages, `⌘K` palette, `⌘N`
create, `⌘I` import `.ics`, `T` today, `⌘,` settings, `Esc` closes overlays); native file dialogs
for `.ics` pick / save and backup export / import; drag-and-drop of `.ics` files onto the Calendar;
window size / position / maximised state persisted; single-instance lock (a second launch focuses
the window); "Open data folder" in the system file manager; external links open in the default
browser and never inside the app window; DevTools and the relaxed CSP exist only in unpackaged
development builds; spellcheck uses the macOS system dictionary offline.

## 3. Process separation

- **Main** (`src/main`): window and menu, security (CSP header + meta tag, navigation guards,
  permission denial, `contextIsolation`, `sandbox`, `nodeIntegration: false`, no `webview`),
  `node:sqlite` connection, migrations and repositories, typed IPC registry with Zod validation at
  the boundary, filesystem (data directory, `.ics` files, JSON backups), the subscription fetcher /
  refresh / scheduler / calendar sync, electron-log.
- **Preload** (`src/preload`): `contextBridge.exposeInMainWorld('api', { invoke, on, off })` over
  an allow-list of channel and event names. No `ipcRenderer`, `fs`, `shell` or Node globals reach
  the page.
- **Renderer** (`src/renderer`): React 19 app that only talks to `window.api` through
  `lib/api.ts`; TanStack Query caches, `data:changed` pushes invalidate; no network access
  (CSP `connect-src 'self'`).
- **Shared** (`src/shared`): types, Zod schemas, the IPC contract, date / zone / countdown logic,
  `.ics` parsing / serialising, conference parsing / diffing / views, deadline-status and timeline
  rules — all framework-free and unit-tested.

## 4. Where local data is stored

`app.getPath('userData')` → macOS `~/Library/Application Support/my-phd-os/`, Windows
`%APPDATA%\my-phd-os\`, Linux `~/.config/my-phd-os/`: `my-phd-os.sqlite` (WAL mode) with every
table, plus `logs/main.log`. Migrations are explicit (`src/main/database/migrations`, schema version
1). Nothing is written anywhere else; the packaged app ignores `MY_PHD_OS_USER_DATA`.

## 5. `.ics` import and export

Import: `parseIcsFiles` (ical.js) → canonical UTC instants for timed events (TZID / offset honoured,
floating → app zone), calendar dates for all-day events (exclusive end), RRULE / RDATE / EXDATE and
`RECURRENCE-ID` overrides kept → `detectDuplicates` (same UID → same UID + recurrence instance →
same title + start instant → same source + start) → preview grouped new / duplicate / conflict /
invalid → commit with skip / replace / keep both into an existing or new calendar source (masters
before instances; cancelled instances become EXDATEs). Export: all events, one source or the visible
range as `VCALENDAR` with `TZID` wall times for IANA zones, UTC for fixed offsets, `VALUE=DATE` for
all-day, recurrence intact, folded lines, stable UIDs.

## 6. CCF subscriptions: generation and refresh

URL = `https://ccfddl.com/conference/deadlines_{en|zh}[_ccf_R][_core_R][_thcpl_R][_SUBJECT].ics`,
fixed filter order, `A*` → `Astar`, previewed before adding; custom `https` URLs need an explicit
trust confirmation and are stored as `custom`. Fetching runs only in the main process
(`src/main/subscriptions/fetcher.ts`): request timeout (default 20 s), `If-None-Match` /
`If-Modified-Since`, SHA-256 content hash, no personal data in the request. Refresh on launch when
the snapshot is older than the interval (default 6 h, `refreshOnLaunch`), periodically while running,
and on demand; status (in progress, last success, last attempt, last error, next automatic check) is
pushed to the UI. Parsing follows the observed feed (`docs/upstream-ccf-feed.md`): random UIDs, so
identity is `name|year|kind|normalizedComment`; the `⏰ Original Deadline (AoE)` label is the
timezone label; `UTC-12:00` style TZIDs; ranks and category lines; zh labels.

## 7. Offline conference caching

Every record is read from SQLite. A failed refresh (offline, timeout, HTTP error, invalid feed)
changes nothing but `lastAttemptAt` / `lastError`; the tab shows _Showing cached data from <time>_
with the error and a Retry. `304 Not Modified` and unchanged hashes are "unchanged". Statuses are
reconciled (`upcoming` → `passed`) from the stored instants without touching the feed, so nothing
ever jumps to next year.

## 8. Upstream change detection

Each snapshot is compared with the stored records by stable key: deadline instant, timezone, website,
conference dates, location, title, round added, round withdrawn (record kept as `TBD`, no date
invented). Each change is stored with previous and current value, detection time and snapshot hash,
and surfaced as _X was updated by CCF Deadlines_ (followed conferences first) until acknowledged;
cards carry _Updated from CCF Deadlines_; linked source-managed calendar events are re-synced;
user-created events are never modified.

## 9. Personal deadline status

`calculateDeadlineStatus` (shared, unit-tested) from tracking start, deadline, stored status and work
progress: `completed` (stored) → `overdue` (past, not completed) → `urgent` (< 24 h and progress
< 90 %) → `at_risk` (work trails time by > 20 points) → `behind` (> 8 points) → `ahead`
(> 10 points ahead) → `on_track`. Time and work are always two separate bars with a pace sentence.

## 10. Timeline checks implemented

1. Milestone passed but incomplete. 2. Linked deadline occurs after the milestone target date.
2. Multiple high-priority deadlines in the same week. 4. Too many overlapping milestones.
3. Time progress substantially exceeds milestone work progress. 6. Milestone start occurs after its
   target. 7. Significant milestone overlap. Warnings are dismissable (persisted) and deep-link to the
   milestone or deadline.

## 11. Running and building

`npm install` · `npm run dev` (development, HMR) · `npm test` · `npm run build` then
`npm run test:e2e` · `npm run build:unpack` produces `release/mac-arm64/My PhD OS.app` (drag into
`/Applications`) · `npm run build:mac` produces DMG + zip. See `README.md` for the
`ELECTRON_RUN_AS_NODE` note.

## 12. Results

| Check                                 | Result                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` (node, web, e2e)  | clean                                                                                                                                                                                                                                                                                                                                                                      |
| `npm run lint` (ESLint 10 + Prettier) | 0 problems                                                                                                                                                                                                                                                                                                                                                                 |
| `npm test` (Vitest, node + jsdom)     | 59 files, 604 tests passed (shared logic, repositories, handlers, integration: migrations, backup, `.ics` import, subscriptions; renderer pages and features)                                                                                                                                                                                                              |
| `npm run build`                       | preload bundle 448 kB, renderer bundle 2.7 MB JS + 78 kB CSS                                                                                                                                                                                                                                                                                                               |
| `npm run test:e2e` (Playwright)       | 18 passed against `out/` (shell, navigation, persistence, fresh-install invariants, screenshots); the real-data-directory check skips itself while the installed app is open (last run: 17 passed, 1 skipped)                                                                                                                                                              |
| Packaging (`electron-builder --dir`)  | `My PhD OS.app` (arm64, 303MB, ad-hoc signed) built from the final code; launch check on the same-day build: `isPackaged: true`, zero user records on first launch, no renderer errors. Unpacked bundles were removed afterwards to save disk space; install from the DMG below                                                                                            |
| Installers (DMG / NSIS / AppImage)    | `release/my-phd-os-0.1.3-universal.dmg` (224 MB, Intel + Apple Silicon, ad-hoc signed, mounts and contains the app + Applications link, no personal strings in the shipped code) — this is the file to install from or give to a friend; first launch of a downloaded copy needs System Settings › Privacy & Security › Open Anyway. NSIS / AppImage configured, not built |

## 13. Known limitations

- Verified on macOS Apple Silicon only; unsigned / not notarised (personal use on this machine).
- Recurring events are edited as a whole series; source-managed conference events are read-only by
  design.
- Conference data quality is bounded by the CCF Deadlines feed (omitted rounds show as TBD).
- No notifications outside the app, no auto-update, no sync — intentionally, for a single-user app.
- The packaged-app smoke launch during verification created an empty database and log in the real
  data directory (`~/Library/Application Support/my-phd-os/`); it is equivalent to a fresh install.
- Disk footprint of the checkout: ~745 MB, almost entirely `node_modules` (Electron binary ≈ 300 MB);
  source, tests and docs are under 10 MB. Delete `node_modules` when not developing.

## 14. Fixes after the first release

Five defects were found by using the built app rather than by the test suite, which stayed green
throughout. Each now has a regression test.

| Defect                                                               | Cause                                                                                                 | Released in |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| Every chip, tint, category dot and coloured bar rendered transparent | `chipStyle` read `--color-<token>`; `@theme inline` names are dropped unless a utility class uses one | 0.1.1       |
| The conference bar was always empty                                  | It measured time elapsed since following, which is zero on the day a conference is added              | 0.1.1       |
| Every conference looked the same                                     | Colour came from urgency alone, so everything beyond thirty days shared one blue                      | 0.1.1       |
| All-day repeating events landed on the wrong dates                   | rrule cannot parse a `VALUE=DATE` DTSTART and silently anchors the series on the current moment       | 0.1.1       |
| Calendar events were drawn as uncoloured boxes                       | `occurrenceColor` had the same `--color-<token>` mistake                                              | 0.1.2       |
| No event could be created between 22:00 and 22:59                    | The default end date was copied from the start date, so the end wrapped to midnight before the start  | 0.1.2       |
| The conference deadline bar barely moved                             | Bar length was measured against a scale set by the furthest deadline, which shrank at the same rate   | 0.1.3       |

`tokens.test.ts` now fails on any palette colour read through a theme name anywhere under `src`,
and `defaultEventTimes` is unit-tested across all twenty-four hours. All five pages were confirmed
by screenshotting the built application.
