# My PhD OS

My PhD OS is a small, local-first desktop app for one PhD student: a **Calendar** (with `.ics`
import/export), **Deadlines** (the few conferences you follow, drawn as bars with big countdowns, plus personal
deadlines with separate time and work progress), a long-term **Timeline** of milestones with sanity checks,
simple **Habits**, and **Settings**. It is a single-user app for one computer: no accounts, no
cloud, no sync, no telemetry, no AI. Everything is stored in one SQLite file on disk, and the only
network access is the main process fetching the conference `.ics` feeds you subscribe to.

The product specification is [`prompt.md`](prompt.md); the engineering contract and decisions log
is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the delivery report is
[`docs/DELIVERY_REPORT.md`](docs/DELIVERY_REPORT.md) (中文版 [`docs/DELIVERY_REPORT.zh-CN.md`](docs/DELIVERY_REPORT.zh-CN.md)); the observed upstream feed format is
[`docs/upstream-ccf-feed.md`](docs/upstream-ccf-feed.md).

## Supported platforms

- **macOS (Apple Silicon)** — developed and verified here: unit, integration and Playwright
  end-to-end tests, plus a smoke launch of the packaged app bundle.
- **Windows** and **Linux** — electron-builder targets are configured (NSIS installer, AppImage)
  but have not been built or tested on those platforms.

## Technology stack

Electron 44 (Node 24 runtime) · electron-vite 5 / Vite 7 · React 19 · TypeScript 5.9 (strict) ·
Tailwind CSS 4 · Radix UI + `cmdk` + `lucide-react` · FullCalendar 6.1 · Luxon · ical.js · rrule ·
Zod 4 · Zustand · TanStack Query · `node:sqlite` (`DatabaseSync`, bundled with Electron's Node — no
native build step) · electron-log · Vitest 5 · Playwright (`_electron`) · electron-builder 26.

## Development prerequisites

- Node.js ≥ 24 and npm ≥ 10. No Python, Docker or native toolchain: SQLite comes from `node:sqlite`.
- Disk: `node_modules` is about 730 MB (the Electron binary alone is ~300 MB). Delete it when you are
  not developing; `npm install` restores it.

## Install, run, test, build

```sh
npm install                 # installs dependencies (also runs electron-builder install-app-deps)
npm run dev                 # development mode with hot reload; opens the Electron window
npm run lint                # ESLint (includes Prettier formatting rules)
npm run typecheck           # tsc for the main/preload/shared, renderer and e2e projects
npm test                    # Vitest unit + integration tests (node and jsdom projects)
npm run build               # typecheck + production build into out/
npm run test:e2e            # Playwright drives the built app in out/ (run npm run build first)
npm start                   # runs the production build in out/ without packaging
```

### Generating the standalone application

```sh
npm run build:unpack        # unpacked app bundle:  release/mac-arm64/My PhD OS.app  (~300 MB)
npm run build:mac           # DMG + zip installers into release/
npm run build:win           # NSIS installer (run on Windows)
npm run build:linux         # AppImage (run on Linux)
```

Drag `My PhD OS.app` into `/Applications` to install it. The bundle is not code-signed or
notarised (no Apple developer identity); an app built on this Mac opens normally, while a copy
downloaded from elsewhere needs right-click → Open the first time. `release/` is git-ignored and
large, so delete it after installing.

### Giving the app to a friend

The `.app` and the DMG contain only code: your database lives in your own
`~/Library/Application Support/my-phd-os/`, so a copy of the app carries none of your data and
every installation starts empty.

```sh
npm run build:mac -- dmg --universal    # release/my-phd-os-<version>-universal.dmg (Intel + Apple Silicon)
```

Send the DMG (AirDrop, a shared drive, a message). Because the app is not signed with an Apple
Developer ID, macOS blocks the first launch of a downloaded copy: your friend opens the DMG, drags
_My PhD OS_ into Applications, double-clicks it once (macOS refuses), then goes to System Settings ›
Privacy & Security and clicks **Open Anyway** next to the app. After that it opens normally. The
terminal alternative is `xattr -dr com.apple.quarantine "/Applications/My PhD OS.app"`. Removing
that step would need a paid Apple Developer account for signing and notarisation. Windows and Linux
builds (`npm run build:win`, `npm run build:linux`) are configured but must be run on that platform
and have not been tested.

### The `ELECTRON_RUN_AS_NODE` quirk

Shells launched from VS Code export `ELECTRON_RUN_AS_NODE=1`, which makes any Electron binary start
as plain Node and exit immediately. Every npm script that launches Electron goes through
`scripts/with-electron-env.mjs`, which removes that variable. When running Electron by hand, prefix
the command with `env -u ELECTRON_RUN_AS_NODE`.

## Where local data is stored

Everything lives under Electron's `app.getPath('userData')`:

| Platform | Directory                                  |
| -------- | ------------------------------------------ |
| macOS    | `~/Library/Application Support/my-phd-os/` |
| Windows  | `%APPDATA%\my-phd-os\`                     |
| Linux    | `~/.config/my-phd-os/`                     |

Inside it: `my-phd-os.sqlite` (plus `-wal` / `-shm` while the app is open) holding every record —
calendar events and sources, personal deadlines, conference snapshots, followed conferences, change
history, milestones, habits and completions, settings, dismissed warnings — and `logs/main.log`.
Settings › Data shows the exact path and opens the folder. Two environment variables exist for
testing: `MY_PHD_OS_USER_DATA=<dir>` overrides the directory in development builds only (the
packaged app ignores it; every test sets it, so tests never touch your real data), and
`MY_PHD_OS_E2E=1` disables the startup subscription refresh and background fetching.

## How conference deadlines work

- **Only the conferences you choose.** The Conference Deadlines tab is a short board: one row per
  chosen conference with a bar from the day you added it to the deadline (filled with the time
  already gone and coloured blue → green → amber → red as the deadline nears), the deadline in its
  original timezone and in local time, and a big countdown. A small axis above shows where the
  deadlines fall over the coming months. Click a row for the details sheet (ranks, dates, location,
  homepage, intention and notes, add to calendar, remove).
- **The CCF Deadlines list is a lookup source, not a feed you follow.** _Add conference_ opens a
  search box over the list; the first time, one click loads the official list (English or 简体中文)
  from `https://ccfddl.com/conference/`. Add the few conferences you care about; nothing else is
  shown anywhere. Filtered feeds (by CCF / CORE / TH-CPL rank or subject) and custom `https` URLs
  are still available under _Filtered feed or custom URL…_ and in Settings › Conference
  Subscriptions; a custom host is fetched only after you confirm you trust it.
- **Fetching** happens only in the Electron main process, with a timeout, `ETag` / `Last-Modified`
  revalidation and a content hash; the request carries nothing but the feed URL. The list refreshes
  on launch when older than the configured interval (default 6 hours), periodically while the app
  runs, and on _Refresh_. If a refresh fails the cached list stays and the status line says so.
- **Records are source-managed**: canonical dates cannot be edited; a round the list no longer
  contains becomes **TBD** (no fake date, no countdown, no calendar event); passed rounds say
  _Passed_ and never jump to next year.
- **Add to Calendar** creates one source-managed event in a `CCF Deadlines` calendar source at the
  exact deadline instant, linked to the record and the homepage; refreshes keep it in sync; removing
  the conference or _Remove from calendar_ deletes it. Your own preparation events are never touched.
- **Upstream changes** to a chosen conference (deadline, timezone, website, dates, location, title,
  round added or withdrawn) appear above the board as _X was updated by CCF Deadlines_ with previous
  and current values until you acknowledge them.

## How `.ics` import and export work

- **Import**: Calendar › Import .ics (`⌘I` / `Ctrl+I`), the palette, or drop files onto the Calendar
  page. Files are parsed with ical.js; timed events become UTC instants (a `TZID` or offset is
  honoured, floating times take your app timezone), all-day events stay calendar dates, recurrence
  rules, exceptions and modified instances are preserved. A preview lists every event as new,
  duplicate (same UID, same recurrence instance, same start instant, or same source) or invalid, and
  you choose skip / replace / keep both before anything is written. Each import can go into an
  existing or new calendar source so it can be recoloured, hidden or removed as a group.
- **Export**: Calendar › Export .ics writes all events, a single source or the visible range as a
  standard `VCALENDAR` — timed events with their zone, all-day events as `VALUE=DATE`, recurrence
  rules intact — that Apple Calendar, Google Calendar and Outlook can read.

## How JSON backup and restore work

Settings › Data › _Export backup_ writes one readable JSON file containing every table of your data
(format `my-phd-os-backup`, with the app and schema version). _Import backup_ first shows a preview
— record counts per table and any warnings — and then applies it in one transaction, either
**replacing** your current data or **merging** into it. Backups made by a newer version of the app
are refused rather than half-applied.

## How offline caching works

Conference deadlines are read from the local snapshot in SQLite, never live. When a refresh fails
(offline, timeout, upstream error) the previous snapshot and every conference record stay exactly as
they were; the tab says _Showing cached data from …_ with the snapshot time and the error, and offers
_Retry_. Everything else in the app is your own data and needs no network at all.

## Privacy behaviour

- All data stays on this computer in the directory above. Nothing is uploaded, synced or reported.
- The only network requests are `GET`s for the subscription `.ics` URLs you added, from the main
  process. The renderer has no network access (Content Security Policy `connect-src 'self'`).
- Approved host: `https://ccfddl.com`. Any other host requires a per-subscription confirmation.
- No analytics, crash reporting, auto-update or AI features exist in the code base. macOS
  spellcheck uses the system dictionary offline; elsewhere spellcheck is disabled so Electron never
  downloads dictionaries.
- Electron hardening: `contextIsolation`, `sandbox`, `nodeIntegration: false`, no `webview`, strict
  CSP, navigation and permission guards; the preload exposes only `window.api` (`invoke`/`on`/`off`).

## Clearing application data means permanent loss

The SQLite file is the only copy of your calendar, deadlines, follows, timeline and habits. Deleting
the data directory, "clearing app data", removing the app with a cleaner utility, or reinstalling
the OS removes it permanently; there is no server copy and no undo. **Export a JSON backup
regularly** (and before upgrading or moving computers) and keep it somewhere that is itself backed
up. `.ics` exports are a second, calendar-only safety net.

## Current limitations

- Only macOS (Apple Silicon) has been built and tested; Windows/Linux packaging is configured but
  unverified. The bundle is unsigned and not notarised.
- Recurring events are edited as a whole series (no "this occurrence only" edits); source-managed
  conference events are read-only by design.
- Conference data is only as good as the CCF Deadlines feed: rounds it omits are shown as TBD, and
  the app never guesses dates.
- Windows/Linux notifications, auto-update and multi-device sync are intentionally out of scope for
  a personal single-computer app.

## Repository layout

```
src/main       Electron main: window, menu, security (CSP, navigation, permissions), IPC registry +
               handlers, SQLite connection/migrations/repositories, subscriptions (fetcher, refresh,
               scheduler, calendar sync), filesystem (ics, backup, data dir), logging
src/preload    contextBridge → window.api ({ invoke, on, off }) — nothing else
src/renderer   React app: shell (sidebar, top bar, palette, theme), pages, features/*, ui primitives
src/shared     Types, Zod schemas, IPC contract, dates/countdown/zones, ics, conferences, backup,
               deadline-status, timeline rules, habits streaks
tests          unit · integration · e2e · fixtures (sample CCF feeds, .ics) · setup
docs           ARCHITECTURE.md · FOUNDATION_API.md · upstream-ccf-feed.md · DELIVERY_REPORT.md
```

`.gitignore` excludes databases (`*.sqlite*`, `*.db*`), backups (`*.backup.json`, `backups/`),
imported/exported calendars (`*.ics` except `tests/fixtures/**`), build output (`out/`, `dist/`),
installers (`release/`), logs, coverage and Playwright output, e2e screenshots and platform temp
files. Never commit personal data.
