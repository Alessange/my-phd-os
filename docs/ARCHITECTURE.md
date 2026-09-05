# My PhD OS — Architecture & Conventions

This document is the binding contract for everyone (human or agent) working in this repository.
The product specification is `prompt.md` at the repo root; when this document and the spec
disagree, the spec wins and this document must be corrected. Read `docs/upstream-ccf-feed.md`
before touching anything conference-related.

## 0. Non-negotiables (from the spec)

1. Standalone Electron desktop app. Packaged build loads bundled local files; no browser, no
   localhost, no server, no Docker, no Python, no cloud, no auth.
2. **No AI anywhere.** No assistants, chat, LLM calls, "insights", predictions, or fake AI buttons.
   Every status and warning is a transparent deterministic rule in `src/shared`.
3. **No seeded or mock personal data** in the production database. A fresh install has zero events,
   deadlines, milestones, habits, subscriptions, and follows no conference. Form placeholders may
   show examples; nothing is saved automatically. Fixtures live only under `tests/`.
4. Conference deadlines (source-managed, from CCF `.ics`) and personal deadlines (user-owned) are
   separate entities, tables, IPC channels, and UI tabs. Users can never edit canonical upstream data.
5. All personal data stays on disk under `app.getPath('userData')`. Network access happens only in
   the main process and only to fetch subscription `.ics` files. Requests carry no personal data.
6. Every page has a designed empty state; every color-coded status also has text and, where
   sensible, an icon. Light, Dark, and System themes are all first-class.
7. No silent `catch` blocks. Errors are logged locally (electron-log) and surfaced with a retry or
   safe next action.

## 1. Stack (pinned; do not add dependencies without updating this section)

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Electron 44.2 (Node 24.20, Chromium 152) | `process.versions` verified 2026-09-04 |
| Bundler | electron-vite 5 + Vite 7.3 | electron-vite 5 does **not** support Vite 8 |
| UI | React 19, TypeScript 5.9 strict | TS 7 (Go port) is deliberately not used |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`), `tw-animate-css` | CSS-first config in `src/renderer/src/styles/globals.css` |
| Primitives | Radix UI (`@radix-ui/react-*`), `cmdk`, `lucide-react`, `sonner` | shadcn-style wrappers live in `src/renderer/src/components/ui` |
| Calendar | FullCalendar **6.1.21** (`@fullcalendar/{core,react,daygrid,timegrid,list,interaction,rrule,luxon3}`) | v6 API only; v7 has a different API and is not installed |
| Recurrence | `rrule` 2.8 (renderer expansion via FullCalendar) + `ical.js` 2.2 (parsing/expansion in main/shared) | |
| Time | Luxon 3.7 (`luxon`, `@types/luxon`) | the only date library; no `date-fns`, no `moment` |
| Charts | Recharts 3 | only where a chart is genuinely useful |
| Validation | Zod 4 | every IPC payload is validated in main |
| State | Zustand 5 (UI state), TanStack Query 5 (server-state cache over IPC) | |
| Persistence | **`node:sqlite`** (`DatabaseSync`) built into Electron's Node | see §5 for the tradeoff |
| Logging | `electron-log` 5 | `userData/logs/main.log` |
| Tests | Vitest 5 (+ jsdom, Testing Library), Playwright 1.62 `_electron` | |
| Packaging | electron-builder 26 | dmg/zip (mac), nsis (win), AppImage (linux) |

Environment quirk: shells launched from VS Code export `ELECTRON_RUN_AS_NODE=1`, which makes any
Electron binary start as plain Node. All npm scripts that launch Electron go through
`scripts/with-electron-env.mjs`, which deletes that variable before spawning. When running Electron
by hand, prefix with `env -u ELECTRON_RUN_AS_NODE`.

## 2. Process model and security

```
┌──────────────── main (Node) ───────────────┐   ┌── preload (sandboxed) ──┐   ┌──── renderer (React) ────┐
│ window mgmt · menu · dialogs · shell       │   │ contextBridge exposes   │   │ pages · components        │
│ SQLite (node:sqlite) · migrations · repos  │◄──┤ window.api.invoke/on    │◄──┤ TanStack Query over api   │
│ subscriptions fetch (net) · ics/json io    │   │ nothing else            │   │ zustand UI state          │
│ IPC handlers: zod-validate → repo → emit   │   └─────────────────────────┘   │ no node, no fs, no fetch  │
└────────────────────────────────────────────┘                                 └───────────────────────────┘
```

* `BrowserWindow` webPreferences: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`, `webviewTag: false`.
* Preload exposes exactly one object, `window.api`, with `invoke(channel, payload)`, `on(event, cb)`
  and `off(event, cb)`. It exposes no `ipcRenderer`, no `fs`, no `shell`.
* Every `ipcMain.handle` goes through `src/main/ipc/registry.ts`, which looks up the channel's Zod
  request schema, validates, calls the handler, and converts thrown errors into a serialisable
  `IpcError` (`{ code, message, details? }`). Unknown channels are rejected.
* Navigation lockdown in `src/main/security/`: `will-navigate` is blocked unless the target is the
  app's own dev-server origin (dev) or `file:` (prod); `setWindowOpenHandler` denies everything and
  opens validated `http(s)` URLs via `shell.openExternal`; `will-attach-webview` is denied.
* Content Security Policy is set by `session.defaultSession.webRequest.onHeadersReceived` (prod) and
  mirrored by the `<meta http-equiv>` tag in `src/renderer/index.html`. Production policy:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
  font-src 'self' data:; connect-src 'self'`. Dev may relax `script-src`/`connect-src` for HMR only.
* External links: renderer calls `app:openExternal`; main allows only `http:`/`https:`.
* Network: only `src/main/subscriptions/fetcher.ts` performs HTTP (Node `fetch` with `AbortSignal`
  timeout, ETag/Last-Modified conditional requests, no proxies). Approved hosts are listed in
  `src/shared/constants/hosts.ts` (`https://ccfddl.com`). Custom URLs require explicit user
  confirmation stored on the subscription record.

## 3. Directory layout and ownership

```
src/
  main/
    index.ts                 app lifecycle, single-instance lock, window creation, startup refresh
    windows/mainWindow.ts    BrowserWindow factory + window-state persistence (bounds, maximised)
    menu/appMenu.ts          native menu; accelerators emit `app:command` events to the renderer
    security/                csp.ts · navigation.ts · openExternal.ts
    ipc/registry.ts          typed handler registration + validation + error envelope
    ipc/handlers/<feature>.ts one file per feature (see ownership table)
    database/connection.ts   opens userData/my-phd-os.sqlite (WAL, foreign_keys=ON)
    database/migrate.ts      applies migrations/*.sql in numeric order, records in schema_migrations
    database/migrations/     001_initial.sql … (numbered ranges below)
    database/repositories/   one module per table; the only place SQL is written
    database/changeBus.ts    emits `data:changed` (debounced) with the touched entity names
    subscriptions/           CCF fetcher, parser adapter, snapshot comparison, scheduler
    filesystem/              dialogs.ts · icsFiles.ts · backup.ts · dataDirectory.ts
    logging/logger.ts        electron-log setup; never logs personal payloads
  preload/index.ts           contextBridge → window.api
  preload/index.d.ts         `Window.api` typing (imports from src/shared)
  renderer/src/
    main.tsx · App.tsx
    app/                     navigation.ts (zustand) · commands.ts · quickCreate.ts · shortcuts.ts · queryClient.ts
    app/layout/              AppShell.tsx · Sidebar.tsx · TopBar.tsx · CommandPalette.tsx · ThemeProvider.tsx
    pages/                   CalendarPage.tsx · DeadlinesPage.tsx · TimelinePage.tsx · HabitsPage.tsx · SettingsPage.tsx
    components/ui/           shadcn-style primitives (button, input, label, textarea, select, switch,
                             slider, checkbox, dialog, alert-dialog, sheet, tabs, tooltip, popover,
                             dropdown-menu, scroll-area, badge, card, progress, command, separator, skeleton)
    components/common/       EmptyState · StatusBadge · CategoryChip · Countdown · ProgressBar
                             · DualProgress · ZonedTime · PageHeader · KeyboardHint · ErrorState
    features/<feature>/      api.ts (query hooks + mutations) · commands.ts · components/ · hooks/ · lib/
    hooks/                   useNow · useSettings · useFormat · useDataChanged · useKeyboardShortcut
    lib/api.ts               typed `api<'channel'>(payload)` wrapper around window.api
    lib/queryKeys.ts         all query keys + entity→keys invalidation map
    styles/globals.css       Tailwind theme tokens (light/dark), category + status palettes
    types/                   renderer-only types
  shared/
    errors.ts                `AppError` (closed `AppErrorCode` union) · `toIpcError` / `fromIpcError`
    types/                   common.ts · calendar.ts · personalDeadline.ts · conference.ts · milestone.ts · habit.ts
                             · settings.ts (`DEFAULT_SETTINGS`, `DEFAULT_UI_STATE`) · app.ts · data.ts · index.ts
                             (mirror spec §9.3, §10.2, §12.3, §12.6, §12.8, §13, §15, §16 + §4 additions)
    ipc/defineChannel.ts     `defineChannel` helper + `ChannelDefinition`/`Contract` (imported by channel files)
    ipc/contract.ts          aggregated `channels` map, `ChannelName`/`RequestOf`/`ResponseOf`/`ChannelHandlers`, `WindowApi`
    ipc/events.ts            `EntityName`, push event names + payload types
    ipc/channels/<feature>.ts per-feature channel definitions (owned by that feature)
    schemas/                 Zod 4 schemas for every domain type + create/update inputs + channel requests
    constants/               categories.ts · statuses.ts · hosts.ts · shortcuts.ts · emptyStates.ts · timezones.ts · ccf.ts
    dates/                   zones.ts · instant.ts · countdown.ts · progress.ts · format.ts · allDay.ts
    deadline-status/         config.ts (thresholds) · calculateDeadlineStatus.ts
    ics/                     parse.ts · serialize.ts · duplicates.ts (pure; no fs)
    conferences/             buildSubscriptionUrl.ts · parseConferenceFeed.ts · stableKey.ts · compareSnapshots.ts
    timeline/                detectTimelineWarnings.ts · rules.ts
    habits/                  streaks.ts · schedule.ts
    backup/                  format.ts (version, envelope) · validate.ts
tests/
  unit/ integration/ fixtures/{ics,ccf,backup}
  e2e/smoke.spec.ts          bridge, IPC validation, settings round-trip (main-process phase)
  e2e/shell.spec.ts          shell: launch, sidebar order, empty states, palette, shortcuts, theme + last page
                             + window bounds across relaunch, sandbox shape, zero rows, real userData untouched
  e2e/visual.spec.ts         screenshots of every page in light/dark into e2e/__screenshots__/ (git-ignored)
  e2e/helpers/launchApp.ts   launches out/ with temp userData; `launchApp({ userDataDir })` relaunches; `waitForShell`
  e2e/helpers/realUserData.ts real userData path per platform + recursive listing snapshot
  setup/renderer.ts          Vitest jsdom setup: jest-dom matchers + `window.api` mock (`windowApi` export)
  setup/windowApiMock.ts     `createWindowApiMock()` — respond()/emit()/reset() over the typed `WindowApi`
scripts/                     with-electron-env.mjs (strips ELECTRON_RUN_AS_NODE, spawns command, propagates exit code)
tsconfig.node.json · tsconfig.web.json · tsconfig.e2e.json   three typecheck projects (see §11)
README.md                    developer README (scripts, data location, ELECTRON_RUN_AS_NODE, e2e); user README comes later
docs/                        ARCHITECTURE.md · upstream-ccf-feed.md · DELIVERY_REPORT.md (final)
```

### Ownership table (parallel feature phase)

Each feature agent may create/modify **only** the paths in its row plus new test files named after
its feature. Everything else is read-only for it. Shared foundation files (`registry.ts`,
`contract.ts`, `preload`, `AppShell`, `components/ui`, `queryKeys.ts`) are owned by the
integration role; feature agents request changes by leaving a `TODO(integration): …` comment in
their own files, never by editing foundation files.

| Feature | Owned paths | Migration range |
| --- | --- | --- |
| calendar | `src/shared/ics/**`, `src/shared/ipc/channels/calendar.ts`, `src/main/ipc/handlers/calendar.ts`, `src/main/database/repositories/{calendarEvents,calendarSources}.ts`, `src/main/filesystem/icsFiles.ts`, `src/renderer/src/features/calendar/**`, `src/renderer/src/pages/CalendarPage.tsx`, `tests/fixtures/ics/**` | 010–019 |
| conferences | `src/shared/conferences/**`, `src/shared/ipc/channels/conferences.ts`, `src/main/ipc/handlers/conferences.ts`, `src/main/subscriptions/**`, `src/main/database/repositories/{conferenceSubscriptions,conferenceDeadlines,followedConferences,conferenceChanges,conferenceSnapshots}.ts`, `src/renderer/src/features/conference-deadlines/**`, `tests/fixtures/ccf/**` | 020–029 |
| personal-deadlines | `src/shared/deadline-status/**`, `src/shared/ipc/channels/personalDeadlines.ts`, `src/main/ipc/handlers/personalDeadlines.ts`, `src/main/database/repositories/personalDeadlines.ts`, `src/renderer/src/features/personal-deadlines/**` | 030–039 |
| timeline | `src/shared/timeline/**`, `src/shared/ipc/channels/milestones.ts`, `src/main/ipc/handlers/milestones.ts`, `src/main/database/repositories/milestones.ts`, `src/renderer/src/features/timeline/**`, `src/renderer/src/pages/TimelinePage.tsx` | 040–049 |
| habits | `src/shared/habits/**`, `src/shared/ipc/channels/habits.ts`, `src/main/ipc/handlers/habits.ts`, `src/main/database/repositories/{habits,habitCompletions}.ts`, `src/renderer/src/features/habits/**`, `src/renderer/src/pages/HabitsPage.tsx` | 050–059 |
| settings-data | `src/shared/backup/**`, `src/shared/ipc/channels/{settings,data}.ts`, `src/main/ipc/handlers/{settings,data}.ts`, `src/main/filesystem/{backup,dataDirectory}.ts`, `src/renderer/src/features/settings/**`, `src/renderer/src/pages/SettingsPage.tsx`, `tests/fixtures/backup/**` | 060–069 |

Cross-feature UI is composed by the integration role from components each feature **exports**:

* `features/habits/components/TodayHabitsCompact.tsx` — today's habits with toggles + streak (Calendar right panel).
* `features/personal-deadlines/components/PersonalDeadlineCompact.tsx` — nearest personal deadline card.
* `features/conference-deadlines/components/FollowedConferenceCompact.tsx` — nearest followed conference card.
* `features/conference-deadlines/components/SubscriptionManager.tsx` — builder + list + refresh (used by Deadlines empty state and Settings).
* `features/conference-deadlines/components/ConferenceDeadlinesTab.tsx`, `features/personal-deadlines/components/PersonalDeadlinesTab.tsx` — the two Deadlines tabs.
* `features/settings/components/ConferenceSubscriptionsSection.tsx` simply renders `SubscriptionManager`.
* `features/<x>/commands.ts` — `Command[]` entries for the command palette (`app/commands.ts` aggregates).
* Each page registers its quick-create handler with `useRegisterQuickCreate(page, fn)`.

## 4. Domain model

Types live in `src/shared/types/*.ts` and mirror the spec verbatim, plus the following additions:

* `CalendarEvent`: `exdates?: string[]`, `rdates?: string[]` (ISO instants / dates), `recurrenceMasterId?: string`
  (for modified instances), `status?: 'confirmed' | 'cancelled'`, `sourceLabel?: string`
  (e.g. `"CCF Deadlines"`), `url?: string`.
* `ConferenceDeadline`: `stableKey: string`, `deadlineKind: 'abstract' | 'deadline'`,
  `conferenceDatesText?: string` (upstream free text, may be `TBD`), `dblpUrl?: string`,
  `firstSeenAt: string`, `lastSeenAt: string`, `originalTimezoneLabel?: string` (e.g. `AoE`),
  `allDay: boolean`. `status` is `'upcoming' | 'passed' | 'tbd'`; `'tbd'` means the round vanished
  from upstream (see feed doc). `deadlineAt` is `undefined` when `status === 'tbd'`.
* `ConferenceSubscription`: `id, url, label, kind: 'official' | 'custom', language?: 'en' | 'zh',
  filters?: { ccf?, core?, thcpl?, subject? }, enabled, etag?, lastModified?, contentHash?,
  lastSuccessAt?, lastAttemptAt?, lastError?: { message, code?, at }, customConfirmedAt?, createdAt, updatedAt`.
* `AppSettings` (single JSON document in `settings` table, key `app`):
  `timezone: 'system' | string`, `dateFormat: 'system' | 'iso' | 'dmy' | 'mdy'`, `weekStartsOn: 0 | 1`,
  `clock: '12h' | '24h'`, `theme: 'light' | 'dark' | 'system'`, `defaultCalendarView:
  'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'`, `launchPage: 'last' | 'calendar'`,
  `subscriptionRefreshIntervalHours: number` (default 6), `refreshOnLaunch: boolean` (default true),
  `requestTimeoutMs: number` (default 20000).
* `UiState` (settings key `ui`): `lastPage`, `calendarView`, `sidebarCollapsed`, `deadlinesTab`,
  `personalDeadlinesView`, `timelineView`.
* Window bounds are stored under settings key `window` (main-process only).
* IDs are UUID v4 strings from `crypto.randomUUID()` (main process). Timestamps are ISO-8601 UTC
  strings (`2026-09-18T11:59:00.000Z`). All-day dates are `YYYY-MM-DD` strings and never converted
  through a timezone.

## 5. Persistence

* Engine: `node:sqlite` `DatabaseSync`. Tradeoff: it is bundled with Electron's Node, so there is no
  native compile, no `electron-rebuild`, no ABI mismatch between Electron (Node 24) and the system
  Node used by Vitest, and nothing to unpack from the asar. Cost: the module is marked "active
  development" in Node 24 and lacks better-sqlite3's extension loading (unneeded here). It is a real
  on-disk SQLite database, never in-memory in production.
* File: `<userData>/my-phd-os.sqlite` with `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`.
  `MY_PHD_OS_USER_DATA` (env) overrides `userData` before `app.whenReady()` for tests.
* Migrations: `src/main/database/migrations/NNN_name.sql`, applied inside a transaction, recorded in
  `schema_migrations(version, name, applied_at)`. A failed migration rolls back, is logged, and the
  app shows a blocking "database could not be upgraded" screen with the log path — it never deletes
  or recreates the file.
* Repositories are plain functions over a `DatabaseSync` instance; rows are mapped to domain types
  in one place (`rowToX`). Booleans are INTEGER 0/1, JSON columns are TEXT.
* After every successful mutation the repository calls `changeBus.emit('calendarEvents')` etc. The
  bus debounces (~30 ms) and broadcasts `data:changed { entities: EntityName[] }` to all windows.
  `EntityName` is the union in `src/shared/ipc/events.ts`.

## 6. IPC contract

```ts
// src/shared/ipc/defineChannel.ts (separate module so channel files never import the aggregate → no cycle)
export const defineChannel = <Req extends z.ZodType, Res>(name: string, request: Req): ChannelDefinition<Req, Res> => ({ name, request, _res: undefined as unknown as Res })
// src/shared/ipc/channels/calendar.ts
export const calendarChannels = {
  'calendar:listEvents': defineChannel<typeof listEventsRequestSchema, CalendarEvent[]>('calendar:listEvents', listEventsRequestSchema),
  ...
}
// src/shared/ipc/contract.ts:  export const channels = { ...appChannels, ...settingsChannels, ...calendarChannels, ... } satisfies Contract
// types: ChannelName · RequestOf<N> (validated output) · RequestInputOf<N> (what the renderer sends) · ResponseOf<N>
//        ChannelHandlers<Ctx> = { [N in ChannelName]: (req: RequestOf<N>, ctx: Ctx) => Promise<ResponseOf<N>> | ResponseOf<N> }
//        WindowApi = { invoke(channel, payload?), on(event, cb) => unsubscribe, off(event, cb) }  (payload optional when the schema accepts undefined)
// renderer:  const events = await api('calendar:listEvents', { rangeStart, rangeEnd })   // fully typed
// main:      registerHandlers(channels, { 'calendar:listEvents': async (req) => repo.list(req), ... })  // TS enforces completeness
```

* Channel names are `domain:verb` in camelCase (`conferences:refreshNow`). Push events are named
  in `src/shared/ipc/events.ts`: `data:changed`, `conferences:refreshStatus`, `app:command`,
  `app:navigate`.
* Handlers never receive raw `IpcMainInvokeEvent` data; they receive the validated payload and a
  `ctx` with `{ window, db, now(): string }`.
* Payload-less channels use `emptyRequestSchema = z.undefined()`; list/filter channels whose whole
  filter object is optional (`conferences:refresh`, `conferences:listDeadlines`, `habits:list`, …)
  accept `undefined` too. Every `update` channel takes `{ id, patch }` built with `patchRequest()`.
* Errors: throw `AppError(code, message, details)` (`src/shared/errors.ts`, codes: VALIDATION,
  NOT_FOUND, CONFLICT, NOT_IMPLEMENTED, IO, NETWORK, TIMEOUT, INVALID_URL, UNTRUSTED_HOST,
  INVALID_ICS, INVALID_BACKUP, UNSUPPORTED_BACKUP_VERSION, MIGRATION_FAILED, CANCELED, PERMISSION,
  INTERNAL); the registry serialises it with `toIpcError`, the renderer rebuilds it with
  `fromIpcError` (which also unwraps Electron's "Error invoking remote method" message). Renderer
  shows `sonner` toasts with a retry when meaningful; nothing is swallowed.
* Native dialogs (open/save) are always initiated from main via a channel (`calendar:pickIcsFiles`,
  `data:exportBackup`). Cancel returns `{ canceled: true }`, never an error.
* Drag-and-drop `.ics`: the renderer reads `File.text()` and sends `{ name, text }[]` to
  `calendar:previewIcsImport`; no file paths cross the bridge from the renderer side.

## 7. Renderer architecture

* Navigation: `useNavigation()` (zustand) with `page: PageId`, `params: Record<string, string>`,
  `navigate(page, params?)`. Persists `lastPage` via `settings:updateUi`. Deep-link params are
  conventions: calendar `{ date, eventId }`, deadlines `{ tab: 'conference' | 'personal', id }`,
  timeline `{ milestoneId }`, habits `{ habitId }`, settings `{ section }`.
* Data: every feature exposes hooks in `features/<x>/api.ts` built on TanStack Query with keys from
  `lib/queryKeys.ts`. `useDataChanged()` (mounted once in `App`) invalidates keys via the
  entity→keys map when `data:changed` arrives. Never keep a second copy of server state in zustand.
* Time: `useNow({ precision: 'minute' | 'second' })` re-renders on a shared ticker. Countdown
  components pick `second` precision when < 24 h remain. Countdowns are always computed from
  canonical instants at render time; never persisted.
* Formatting: `useFormat()` returns `formatDate/Time/DateTime/Zone` honouring settings (timezone,
  clock, date format, week start). Components never call Luxon directly for display.
* Commands: `app/commands.ts` aggregates `features/*/commands.ts` + shell commands into the
  `cmdk` palette (`Cmd/Ctrl+K`). Quick create (`Cmd/Ctrl+N`) dispatches to the current page's
  registered handler. Menu accelerators arrive as `app:command` events and go through the same
  dispatcher (`app/shortcuts.ts`). Shortcuts: `Cmd/Ctrl+K`, `Cmd/Ctrl+N`, `Cmd/Ctrl+I`, `Cmd/Ctrl+,`,
  `Cmd/Ctrl+1–5`, `T` (calendar focused, no modifier, not in an input), `Esc`. Never override OS
  shortcuts (copy/paste/undo/quit/close use standard menu roles).
* Theme: `ThemeProvider` applies `class="dark"` on `<html>` per settings (`system` follows
  `prefers-color-scheme`) and sets `color-scheme`. Tailwind 4 dark variant:
  `@custom-variant dark (&:where(.dark, .dark *))`.
* Layout: collapsible sidebar (icons only when collapsed), top bar with page title, live clock
  (`useNow` second precision), active timezone, quick-create button, palette trigger, theme
  control. Content area scrolls independently. Minimum supported width ~960 px; the Calendar
  right panel collapses under ~1180 px.
* macOS title bar: the window uses `titleBarStyle: 'hiddenInset'` with `trafficLightPosition
  { x: 16, y: 18 }`, so the native buttons occupy x 16–68 / y 18–30 css px inside the 48 px brand
  row of the sidebar (which is the `-webkit-app-region: drag` area together with the top bar).
  Expanded, the brand is offset to `pl-[84px]`; collapsed (56 px rail) the brand icon is hidden
  and the top bar gets `pl-9` so the page title clears the buttons. Nothing else may be placed in
  that region on macOS.
* Accessibility: Radix primitives for focus management; every icon-only button has `aria-label`;
  `prefers-reduced-motion` disables non-essential animation; status badges include text.

## 8. Time handling rules

* `resolveZone(input)` in `src/shared/dates/zones.ts` accepts: `'system'`, any IANA name, `'UTC'`,
  `'AoE'` (→ fixed UTC−12, label `AoE`), `'PT'` (→ `America/Los_Angeles`, DST-aware), `'ET'`
  (→ `America/New_York`), `'UTC-8'`, `'UTC-08:00'`, `'UTC+5:30'`, `'GMT+8'` (→ fixed offsets).
  It returns `{ kind, luxonZone, label, ianaName?, offsetMinutes? }`. Unknown input is an error, not a guess.
* Store canonical instants (`*At` ISO UTC) **and** the original zone string separately. Display
  shows both source time and user-local time. If a source gives only a UTC instant with no zone,
  say "original timezone unavailable"; do not invent one.
* All-day values are `YYYY-MM-DD` and never pass through zone conversion (`dates/allDay.ts`).
* `.ics`: `Z` → UTC instant; `TZID` → resolve (IANA or `UTC±HH:MM` fixed); floating (no `Z`, no
  `TZID`) → interpret in the **import-time application timezone** and record `timezone` as that zone.
* Countdowns: `calculateRemainingTime(targetIso, nowIso)` → `{ totalMs, isPast, days, hours,
  minutes, seconds }`; `formatCountdown` produces `32 days 08 hours 14 minutes`, emphasises
  `hours/minutes` under 24 h, and `Passed 2 days ago` after the instant. TBD never has a countdown.
* Personal deadline math (`dates/progress.ts` + `deadline-status/`): `timeProgress = (now −
  trackingStart) / (deadline − trackingStart)` clamped to `[0, 1]` for display, `paceDifference =
  workProgress − timeProgress×100`; status rule order is exactly the spec's (`Completed`,
  `Overdue`, `Urgent`, `At Risk`, `Behind`, `Ahead`, `On Track`) with thresholds in
  `deadline-status/config.ts`. Tracking start equal to the deadline yields `timeProgress = 1`.

## 9. Categories, statuses, colors

`src/shared/constants/categories.ts` defines one palette keyed by category id, shared by calendar
events, personal deadlines, and milestones (ids overlap intentionally, e.g. `course`, `research`,
`personal`, `other`). Each entry: `{ id, label, colorToken }`. `statuses.ts` defines status ids,
labels, icon names (lucide) and color tokens: Ahead green, On Track blue, Behind orange, At Risk red,
Urgent coral, Completed muted green, Overdue deep red, TBD violet-gray, Passed neutral. Tokens are
Tailwind theme colors in `globals.css` with light and dark values; components consume them via
utility classes (`bg-status-ahead/15 text-status-ahead`). Color is never the only signal.

## 10. Empty-state copy (exact strings)

| Where | Title | Actions |
| --- | --- | --- |
| Calendar | Your calendar is empty. | Import .ics · Create Event |
| Conference Deadlines (no subscription) | No conference subscription yet. | Add CCF Subscription · Enter Subscription URL |
| Conference Deadlines (subscription, not loaded) | loading / error state | Retry |
| Personal Deadlines | No personal deadlines yet. | Add Personal Deadline (+ note that countdowns and progress appear after adding one) |
| Timeline | Your timeline starts here. | Add Milestone |
| Habits | No habits yet. | Create Habit |
| Right-panel sections | compact one-line empty states | — |

## 11. Testing and scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | electron-vite dev with HMR (via `scripts/with-electron-env.mjs`) |
| `npm run typecheck` | `tsc` for node (main/preload/shared/unit+integration tests), web (renderer/shared) and e2e (`tsconfig.e2e.json`: `tests/e2e` with DOM + Node types) |
| `npm run lint` | ESLint 10 flat config |
| `npm test` | Vitest: project `node` (`src/shared`, `src/main`, `tests/unit`, `tests/integration`) and project `renderer` (jsdom, `src/renderer/**/*.test.tsx`) |
| `npm run test:e2e` | Playwright Electron tests in `tests/e2e` against `out/` (run `npm run build` first); each test uses a fresh temp `MY_PHD_OS_USER_DATA`; `visual.spec.ts` also writes screenshots to `tests/e2e/__screenshots__/` (git-ignored) |
| `npm run build` | typecheck + electron-vite production build into `out/` (via `scripts/with-electron-env.mjs`) |
| `npm run build:mac` / `build:win` / `build:linux` / `build:unpack` | `npm run build` then electron-builder (via the wrapper) into `release/` |

Rules: unit tests for every function named in spec §21; fixtures under `tests/fixtures`; e2e tests
never touch the real `userData`; tests never write outside temp directories. `MY_PHD_OS_E2E=1`
disables the startup subscription refresh.

## 12. Rules for the parallel feature phase

1. Touch only your owned paths (§3). Do not edit `package.json`, lockfile, Vite/TS/ESLint configs,
   `registry.ts`, `contract.ts` aggregation, preload, `AppShell`, or `components/ui`. If a primitive
   is missing, build it inside your feature folder and leave a `TODO(integration)` note.
2. Do not run `npm run dev`, `npm run build`, or `npm run test:e2e` (they collide across agents).
   Verify with `npm run typecheck`, `npm run lint`, and `npx vitest run <your paths>`.
3. Use only the hooks/utilities in `src/shared` and `src/renderer/src/{hooks,lib,components}`;
   never call `window.api` directly outside `lib/api.ts`; never call Luxon for display formatting
   outside `useFormat`/`shared/dates`.
4. Keep business logic in `src/shared/<feature>` as pure functions with tests; components stay thin.
5. Every list has a designed empty state; every async action has loading, error (with retry), and
   success feedback; every destructive action confirms.
6. Register your commands in `features/<x>/commands.ts` and your quick-create handler in your page.
7. Finish with `npm run typecheck && npm run lint && npx vitest run <paths>` all green, and write a
   short `features/<x>/README.md` describing what exists and what is left for integration.

## Decisions log

Foundation phase (shared layer), 2026-09-04:

1. **`defineChannel` lives in `src/shared/ipc/defineChannel.ts`**, not in `contract.ts`. Channel files
   import it from there; `contract.ts` re-exports it and imports the channel files. Putting it in
   `contract.ts` would create an ESM cycle (channel file → contract → channel file) and a TDZ error.
2. **Payload-less channels validate `z.undefined()`**; `WindowApi.invoke` makes the payload argument
   optional only for those channels (`InvokeArgs<N>`), so `api('settings:get')` type-checks while
   `api('calendar:getEvent')` requires `{ id }`.
3. **`AppErrorCode` and `IpcError` are declared in `src/shared/types/common.ts`** (`APP_ERROR_CODES`
   const); `errors.ts` re-exports them. Keeps `types/` free of runtime imports from `errors.ts`.
4. **Instant schema accepts `Z` or an explicit offset** (`z.iso.datetime({ offset: true })`); main
   normalises stored values to `…Z` via `wallTimeToInstant`/Luxon `toUTC().toISO()`, which always
   emits milliseconds (`2026-09-18T11:59:00.000Z`).
5. **Timezone strings are validated with `resolveZone`** (`timezoneSchema.refine(isValidZoneInput)`),
   so IPC rejects unknown zones before they reach the database. `resolveZone` also accepts `CT`/`MT`
   aliases and fixed offsets in the real-world range UTC−12:00 … UTC+14:00 only.
6. **`ResolvedZone.kind` is `'iana' | 'fixed' | 'utc'`**; `'system'` resolves to the host IANA zone
   (`ianaName` set). `label` is the input as the user wrote it (`AoE`, `PT`, `UTC-08:00`,
   `America/Los_Angeles`); the moment-specific abbreviation (`PDT`) comes from `formatZoneLabel` /
   `instantToWallTime().zoneLabel`.
7. **Countdown formats**: `long` = `32 days 08 hours 14 minutes`, under 24 h `08 hours 14 minutes 09
   seconds`; `compact` = `32d 08h` / `08h 14m` / `14m 09s`; `stacked` = long segments joined by `\n`;
   past = `Passed 2 days ago` (`Passed 2d ago` compact, `Passed just now` under a minute).
   `countdownSegments()` exposes the same data for custom layouts.
8. **Time progress with `trackingStartAt >= deadlineAt` is `1`** (raw and clamped) at any `now`;
   `calculateDeadlineStatus` then yields `urgent`/`at_risk` before the deadline and `overdue` after.
   `DeadlineStatus` (computed) is a separate union from the stored `PersonalDeadlineStatus`; the
   stored `missed` value does not short-circuit the rules.
9. **All-day dates**: `formatDate`/`formatDateTime`/`formatWeekday` detect `YYYY-MM-DD` input and
   never zone-convert it. `HabitCompletion.date` and `Habit.frequency.specific_days.days` (ISO
   weekday 1–7, Monday = 1) follow the same convention.
10. **Extra type modules**: `types/app.ts` (`AppInfo`, `LogLevel`) and `types/data.ts` (backup
    preview/result, `StorageInfo`, `CLEAR_ALL_DATA_CONFIRMATION`) hold the app/data channel types;
    `DataCounts = Record<Exclude<EntityName, 'settings'>, number>`.
11. **`ConferenceDeadlineView` adds `subscriptionLabel` and `followed?`; `ConferenceDeadlineChangeView`
    adds `conferenceTitle` and `followed`.** `RefreshStatus.perSubscription` is a record keyed by
    subscription id.
12. **Categories** are one palette of 18 ids (`CATEGORIES`) with `colorToken: category-<id>` (underscore
    → hyphen, e.g. `category-phd-progress`) and a lucide icon name; `statuses.ts` also defines
    priorities, stored personal-deadline statuses, milestone statuses, conference statuses, import
    item statuses (`new | duplicate | conflict | invalid`) and refresh outcomes. `globals.css` must
    define every `category-*`, `status-*` and `priority-*` token.
13. **`npm run build` also goes through `scripts/with-electron-env.mjs`** so `electron-vite build`
    never sees `ELECTRON_RUN_AS_NODE`. Scripts that wrap it (`build:*`) inherit that.
14. **Vitest 5 projects are inline in `vitest.config.ts`** (`test.projects`), not a workspace file.
    The renderer project's setup exports the shared `windowApi` mock from `tests/setup/renderer.ts`;
    renderer tests import it from there (same module instance as the setup).
15. **ESLint**: `eslint-plugin-react` is not installed and is not used; React rules come from
    `eslint-plugin-react-hooks` (`configs.flat.recommended`) and `eslint-plugin-react-refresh`
    (`configs.vite`), applied to `src/renderer/**` only. `@typescript-eslint/no-explicit-any` is an
    error. `src/main/index.ts` (smoke scaffold) still has one prettier warning; the main-process
    agent replaces that file.


Main-process / persistence phase, 2026-09-04:

16. **IPC errors travel as a plain envelope, not a thrown error.** `registry.ts` returns
    `{ __ipcError: IpcError }` (`IPC_ERROR_KEY`) from every failed `ipcMain.handle`, because Electron
    serialises a thrown error down to its `message` string and would drop `code`/`details`. The
    preload unwraps the envelope and rejects with the plain `IpcError` object (`{ code, message,
    details? }`), which `fromIpcError` in the renderer already accepts. Unknown channel/event names
    are rejected by the preload with `VALIDATION` before reaching main.
17. **Handler context is `{ db, window, paths, dbError?, now() }`** (`HandlerContext` in
    `registry.ts`). `db` is a getter that throws the startup `AppError` (`MIGRATION_FAILED`/`IO`) when
    the database is unavailable, so `app:getInfo` still answers (with `dbError`) while every data
    channel fails loudly. `AppInfo.dbError?: IpcError` was added to `src/shared/types/app.ts` for
    this; the renderer also receives `?dbError=1` on the initial URL.
18. **Handler modules use `satisfies Partial<Handlers>` and `handlers/index.ts` is typed `Handlers`**,
    so TypeScript rejects a contract channel without a handler. Feature agents replace the
    `notImplemented(...)` stubs inside their own handler file only.
19. **Menu accelerators reuse `SHORTCUTS` from `src/shared/constants/shortcuts.ts`**; the menu sends
    `app:command` with the shared `AppCommandId` (`quickCreate`, `importIcs`, `openSettings`,
    `goToPage` + `{ page }`, `openCommandPalette`), never ad-hoc strings. "About My PhD OS" sends
    `app:navigate { page: 'settings', params: { section: 'about' } }`.
20. **Migrations are TypeScript modules** (`migrations/NNN_name.ts` exporting `{ version, name, sql }`,
    listed in `migrations/index.ts`) rather than `.sql` files, because electron-vite bundles main into
    one file. Each migration runs in its own transaction; the file is never deleted or recreated.
21. **`clearAllUserData` empties every user table including `settings` and `app_meta`, but keeps the
    `window` settings document** (bounds are not personal data) and `schema_migrations`.
    `data:clearAllData` re-records `installedAt`/`lastLaunchedAt` afterwards.
22. **Window state** (`settings` key `window`) is validated against `screen.getAllDisplays()` work
    areas: a saved position must overlap a display by ≥ 64 px on both axes or it is dropped; size is
    clamped to `[960×640, largest work area]`. Persisted 300 ms after resize/move, immediately on
    maximize/unmaximize/close.
23. **The preload bundles `zod` and `luxon`** (`electron.vite.config.ts` → `preload.build.externalizeDeps
    .exclude`) because a sandboxed preload cannot `require` node_modules; only `electron` stays
    external. Main keeps `node:sqlite`, `electron-log`, `zod`, `luxon` external (verified in
    `out/main/index.js`).
24. **Conference subscription URLs**: `conferences:addSubscription` accepts an approved origin
    (`isApprovedSubscriptionUrl`) as given; any other `http(s)` URL requires `confirmCustom: true`
    (else `UNTRUSTED_HOST` with `{ host, approvedHosts }`), is stored with `kind: 'custom'` and
    `customConfirmedAt`. Duplicate URLs are `CONFLICT`. `conferences:getRefreshStatus` is derived from
    the `last_*` columns so it honestly reports "never refreshed" until the fetcher exists.
25. **Logging**: `logAppError(scope, error)` logs `code: message` plus details filtered through an
    allow-list of keys (`id`, `ids`, `code`, `count`, `version`, `path`, `host`, `url`, `channel`, …;
    arrays collapse to their length). Expected errors (`VALIDATION`, `NOT_FOUND`, `CONFLICT`,
    `CANCELED`, `NOT_IMPLEMENTED`) log at `warn`, everything else at `error`. `app:log` writes the
    renderer's message verbatim, so the renderer must not include personal content in it.
26. **E2E harness**: `tests/e2e/helpers/launchApp.ts` launches `out/` with a fresh temp
    `MY_PHD_OS_USER_DATA`, `MY_PHD_OS_E2E=1`, and `ELECTRON_RUN_AS_NODE`/`ELECTRON_RENDERER_URL`
    removed from the environment; it collects renderer console errors and page errors.


Integration / verification phase (shell e2e), 2026-09-04:

27. **E2E specs are type-checked by a third project, `tsconfig.e2e.json`** (extends the web
    tsconfig for the DOM lib, adds Node types, includes `tests/e2e`, `src/preload/index.d.ts` and
    `src/shared`). `npm run typecheck` runs node → web → e2e. In specs the Playwright page variable
    is called `page` (never `window`), so `window.api` inside `page.evaluate(...)` resolves to the
    renderer's typed global. `LaunchedApp.window` was renamed to `LaunchedApp.page` accordingly.
28. **`launchApp` gained `{ userDataDir }` and `close({ keepUserData })`** for relaunch tests (theme,
    last page and window bounds must survive a restart), plus `consoleMessages` (all levels) so
    CSP violations (`Refused to …`) can be asserted absent. `waitForShell(page)` waits for the
    primary navigation.
29. **Real `userData` is asserted untouched by e2e**: `tests/e2e/helpers/realUserData.ts` snapshots
    `~/Library/Application Support/my-phd-os` (per-platform equivalent) before the suite and the
    last shell test compares the listing + mtimes; a missing directory snapshots as `<missing>`.
30. **macOS traffic-light layout fix** (Sidebar/TopBar): the brand icon previously sat under the
    native buttons (both at y 18–30 / x 16–40). See §7 "macOS title bar" for the rule now in force.
31. **Palette trigger label is `Search commands…`** (was `Search or run a command…`, which truncated
    at the 224 px trigger width). The accessible name stays `Open command palette (⌘K)`.
32. **Dev CSP verified, not relaxed further.** With `npm run dev`, Vite injects the React-refresh
    preamble *before* the `<meta http-equiv="Content-Security-Policy">` tag, so the production meta
    policy does not apply to it; the header policy (`DEVELOPMENT_CSP`) allows `'unsafe-inline'`
    scripts and `ws://localhost:*`. Renderer console in dev (`ELECTRON_ENABLE_LOGGING=1`) showed
    `[vite] connected.` and no `Refused to …` lines. `src/main/security/csp.ts` is unchanged.
33. **Shell e2e harness facts**: Playwright's synthesized `Meta+K` / `Meta+1…5` key events reach the
    renderer's keydown dispatcher directly (the native menu accelerators are not triggered by CDP
    input), so both routes are exercised: menu accelerators by `app:command`, keyboard by
    `shortcuts.ts`. Window-bounds persistence is checked with a 4 px tolerance after `setBounds` +
    600 ms (300 ms debounce) + relaunch.
34. **`tests/e2e/__screenshots__/` is git-ignored**; screenshots are inspection aids, not golden
    images. No pixel-diff assertions exist yet.
