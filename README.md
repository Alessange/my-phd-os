# My PhD OS

A local-first desktop app that keeps a PhD student's calendar, deadlines, milestones and habits in
one place, and shows them as time rather than as lists.

Everything lives in a single SQLite file on your own machine. There are no accounts, no cloud, no
sync, no telemetry and no AI. The only time the app reaches the network is to fetch the conference
deadline feeds you explicitly subscribe to.

![The Deadlines page, showing followed conferences as coloured bars with countdowns](docs/images/deadlines.png)

## Contents

- [Installing](#installing)
- [The pages](#the-pages)
- [Conference deadlines](#conference-deadlines)
- [Importing and exporting calendars](#importing-and-exporting-calendars)
- [Your data](#your-data)
- [Privacy](#privacy)
- [Sharing the app](#sharing-the-app)
- [Development](#development)
- [Limitations](#limitations)
- [Further documentation](#further-documentation)

## Installing

### macOS

Download the latest release and drag **My PhD OS** into your Applications folder.

**[Download my-phd-os-0.1.1-universal.dmg](https://github.com/Alessange/my-phd-os/releases/latest)**
· universal, runs on both Apple Silicon and Intel · 220 MB

#### The first launch is blocked

macOS refuses the first launch and says:

> Apple could not verify "My PhD OS" is free of malware that may harm your Mac or compromise your
> privacy.

This is expected. It means the app carries no paid Apple Developer signature, not that anything
was found in it. Apple charges an annual fee to issue one, and this app does not use it.

To allow the app:

1. Double-click it once and let macOS refuse.
2. Open **System Settings › Privacy & Security**.
3. Scroll down to the message about My PhD OS and click **Open Anyway**.

It opens normally from then on.

If macOS still refuses, or reports the app as damaged, sign it locally for your own machine:

```sh
xattr -cr "/Applications/My PhD OS.app"
codesign --force --deep --sign - "/Applications/My PhD OS.app"
```

Run the app from Applications rather than from the mounted disk image; Gatekeeper is stricter about
apps launched directly off a disk image.

### Upgrading

Quit the app, then drag the new version into Applications and choose **Replace**. Your data is not
stored inside the app, so nothing is lost.

### Windows and Linux

Installer targets are configured but no build has been produced or tested. Build one yourself on
the target platform with `npm run build:win` or `npm run build:linux`.

## The pages

| Page          | What it holds                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Calendar**  | Month, week, day and list views. Per-event timezones, repeating events, `.ics` import and export, and a side panel showing today, the next event, the nearest deadline and today's habits. |
| **Deadlines** | Conference deadlines you follow, and your own personal deadlines with separate bars for time elapsed and work completed.                                                                   |
| **Timeline**  | Milestones drawn as bars across a semester, a year or the whole programme, with seven checks that flag slipping or overcrowded plans.                                                      |
| **Habits**    | Daily and weekly habits with streaks and a weekly progress bar.                                                                                                                            |
| **Settings**  | Timezone and date formats, conference sources, JSON backup and restore, and where your data lives.                                                                                         |

Press `⌘K` for the command palette, `⌘N` to create something on the current page, and `⌘1` to `⌘5`
to move between pages.

## Conference deadlines

The Deadlines page shows **only the conferences you choose**. Each one gets a row with its own
colour: a countdown on the right, and a bar whose length is the time still remaining. All bars
share one scale, so a short bar means a near deadline. Click any row for full details, including
ranks, conference dates, location, homepage, and your own notes.

### Adding a conference

Choose **Add conference** and search. The first time, one click loads the public CCF Deadlines list
in English or 简体中文. That list is only a place to search: nothing appears on your board until you
add it.

For a narrower source, use **Filtered feed or custom URL** to subscribe to a feed filtered by CCF,
CORE or TH-CPL rank, or by subject. Custom `https` sources are supported and are only fetched after
you confirm you trust the host.

### Refreshing

The list refreshes when the app starts if the cached copy is older than the configured interval
(six hours by default), periodically while the app runs, and whenever you choose **Refresh**.

Refreshing happens in the app's main process and sends nothing but the feed URL. If a refresh fails
the cached list is kept, and the status line tells you when the data was last updated and what went
wrong.

### How records behave

Conference records come from the feed and cannot be edited.

- A round the feed no longer lists becomes **TBD**. The app never invents a date or a countdown for
  it, and never places it on your calendar.
- A round whose deadline has passed is shown as **Passed**. It never rolls forward to next year.
- **Add to Calendar** creates one linked event at the exact deadline instant. Later refreshes keep
  that event in step; removing the conference removes the event. Any preparation events you create
  yourself are never touched.
- When a deadline, timezone, website, location or round changes upstream, a notice appears above
  the board with the previous and current values, and stays until you acknowledge it.

## Importing and exporting calendars

### Import

Choose **Import .ics** from the Calendar page, press `⌘I`, or drop files onto the page.

Timed events are converted to exact instants, honouring the timezone in the file; floating times
take your app timezone. All-day events stay as calendar dates. Repeating rules, exceptions and
individually modified occurrences are all preserved.

Before anything is written, a preview classifies each event as new, duplicate or invalid, and you
choose whether to skip, replace or keep both. Each import can go into its own calendar source so it
can be recoloured, hidden or removed as a group.

### Export

Choose **Export .ics** to write all events, a single calendar source, or just the visible range.
The output is standard `VCALENDAR` that Apple Calendar, Google Calendar and Outlook can read.

## Your data

### Where it is stored

| Platform | Location                                   |
| -------- | ------------------------------------------ |
| macOS    | `~/Library/Application Support/my-phd-os/` |
| Windows  | `%APPDATA%\my-phd-os\`                     |
| Linux    | `~/.config/my-phd-os/`                     |

That folder holds `my-phd-os.sqlite`, which contains every record the app keeps, and `logs/`.
**Settings › Data** shows the exact path and can open the folder for you.

### Backups

**Settings › Data › Export backup** writes your entire database to one readable JSON file.

**Import backup** shows a preview of what the file contains before applying it, then either
replaces your current data or merges into it. A backup written by a newer version of the app is
refused rather than half-applied.

> **Back up regularly.** The SQLite file is the only copy of your data. Deleting the folder,
> clearing application data, removing the app with a cleaning utility or reinstalling macOS erases
> it permanently. There is no server copy and no undo. Keep your backups somewhere that is itself
> backed up. An `.ics` export is a useful second net, but it covers the calendar only.

### Working offline

Conference deadlines are always read from the local copy, never fetched on demand, so the app is
fully usable offline. Everything else is your own data and never needs the network at all.

## Privacy

- Your data stays on your computer. Nothing is uploaded, synced or reported.
- The only network requests are fetches of the conference feed URLs you added, made by the app's
  main process. The interface itself has no network access at all.
- `https://ccfddl.com` is the only pre-approved host. Any other source needs your explicit
  confirmation before it is fetched.
- There is no analytics, no crash reporting, no automatic updating and no AI anywhere in the code.
- Spellcheck uses the macOS system dictionary offline. On other platforms it is disabled, so no
  dictionary is ever downloaded.

## Sharing the app

The app contains only code. Your database lives in your own user folder, so a copy carries none of
your data and every installation starts empty.

Send someone the [release link](https://github.com/Alessange/my-phd-os/releases/latest), or build a
disk image yourself:

```sh
npm run build:mac -- dmg --universal
```

They will need the **Open Anyway** step described under [Installing](#installing), because the app
is unsigned. Removing that step would require a paid Apple Developer account.

## Development

### Requirements

Node.js 24 or newer, and npm 10 or newer. Nothing else: SQLite ships inside Electron, so there is
no Python, Docker or native build toolchain to install.

Note that `node_modules` is roughly 730 MB, most of it the Electron binary. Delete it when you are
not working on the app and restore it with `npm install`.

### Commands

| Command                | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `npm install`          | Install dependencies                                          |
| `npm run dev`          | Run in development with hot reload                            |
| `npm run lint`         | ESLint, including formatting rules                            |
| `npm run typecheck`    | Type-check the main, renderer and end-to-end projects         |
| `npm test`             | Unit and integration tests                                    |
| `npm run build`        | Type-check and build into `out/`                              |
| `npm run test:e2e`     | End-to-end tests against the build; run `npm run build` first |
| `npm start`            | Run the production build without packaging                    |
| `npm run build:unpack` | Build an unpacked `.app` into `release/`                      |
| `npm run build:mac`    | Build a disk image and zip into `release/`                    |

`release/` is excluded from version control and is large. Delete it once you have installed or
shared the build.

### Project layout

| Path           | Contents                                                                               |
| -------------- | -------------------------------------------------------------------------------------- |
| `src/main`     | Window, menu, security, IPC handlers, SQLite, conference subscriptions, files, logging |
| `src/preload`  | The bridge exposing `window.api` to the interface, and nothing else                    |
| `src/renderer` | The React app: shell, pages, features and UI primitives                                |
| `src/shared`   | Types, schemas, the IPC contract, and all date, calendar, conference and rules logic   |
| `tests`        | Unit, integration and end-to-end tests, with fixtures                                  |
| `docs`         | Architecture, API notes, the upstream feed format, and delivery reports                |

### Built with

Electron 44 · React 19 · TypeScript 5.9 · Tailwind CSS 4 · Radix UI · FullCalendar 6 · Luxon ·
ical.js · rrule · Zod 4 · Zustand · TanStack Query · `node:sqlite` · Vitest · Playwright ·
electron-builder

### A note on `ELECTRON_RUN_AS_NODE`

Shells started from VS Code set `ELECTRON_RUN_AS_NODE=1`, which makes any Electron binary start as
plain Node and exit immediately. Every npm script that launches Electron already clears it. If you
run Electron by hand, prefix the command:

```sh
env -u ELECTRON_RUN_AS_NODE npx electron .
```

## Limitations

- Only macOS on Apple Silicon has been built and tested. The disk image is universal, but the Intel
  half is untested, and Windows and Linux builds have never been produced.
- The app is unsigned and not notarised, so a downloaded copy needs the **Open Anyway** step.
- Repeating events are edited as a whole series. Editing a single occurrence is not supported.
- Conference data is only as good as the CCF Deadlines feed. Rounds the feed omits appear as TBD,
  and the app never guesses a date.
- There are no system notifications, no automatic updates and no multi-device sync. These are
  deliberately out of scope for a single-user app.

## Further documentation

| Document                                                         | What it covers                                  |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                   | Engineering contract and the full decisions log |
| [`docs/FOUNDATION_API.md`](docs/FOUNDATION_API.md)               | Reusable hooks, components and repositories     |
| [`docs/upstream-ccf-feed.md`](docs/upstream-ccf-feed.md)         | The real shape of the CCF Deadlines feed        |
| [`docs/DELIVERY_REPORT.md`](docs/DELIVERY_REPORT.md)             | What was built and how it was verified          |
| [`docs/DELIVERY_REPORT.zh-CN.md`](docs/DELIVERY_REPORT.zh-CN.md) | 交付报告（中文版）                              |
| [`prompt.md`](prompt.md)                                         | The original product specification              |
