# My PhD OS — developer README

> This is the contributor-facing README for the current development phase. The user-facing README
> (installation, feature guide, privacy notes) is written in the delivery phase.

My PhD OS is a standalone, local-first Electron desktop application for a PhD student's calendar,
deadlines (conference deadlines from CCF Deadlines `.ics` subscriptions, and personal deadlines),
long-term timeline, and habits. Everything lives in a SQLite database on the user's computer; the
only network access is the main process fetching subscription `.ics` files. There are no AI
features, no accounts, no cloud, and no seeded personal data.

The binding engineering contract is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the product
specification is [`prompt.md`](prompt.md); the observed upstream feed format is
[`docs/upstream-ccf-feed.md`](docs/upstream-ccf-feed.md). Read them in that order before changing
anything.

## Stack

Electron 44 · electron-vite 5 / Vite 7 · React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 ·
Radix UI + `cmdk` + `lucide-react` · FullCalendar 6.1 · Luxon · ical.js · Zod 4 · Zustand ·
TanStack Query · `node:sqlite` (`DatabaseSync`, bundled with Electron's Node — no native build) ·
electron-log · Vitest 5 · Playwright 1.62 (`_electron`) · electron-builder 26.

## Prerequisites

- macOS (arm64 verified), Windows, or Linux.
- Node.js ≥ 24 and npm ≥ 10 (developed on Node 26 / npm 11).
- No Python, Docker, or native toolchain is required: SQLite comes from `node:sqlite`.

```sh
npm install          # also runs electron-builder install-app-deps
```

Dependencies are pinned in `package.json`; do not add, remove, or upgrade packages without
updating `docs/ARCHITECTURE.md` §1.

## npm scripts

| Script                                                             | What it does                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `npm run dev`                                                      | electron-vite dev server with HMR; opens the Electron window                                  |
| `npm run typecheck`                                                | `tsc --noEmit` for the node (main/preload/shared/unit tests), web (renderer) and e2e projects |
| `npm run lint`                                                     | ESLint 10 flat config (includes Prettier formatting rules)                                    |
| `npm run format`                                                   | Prettier over the repository                                                                  |
| `npm test`                                                         | Vitest unit + integration tests (node and jsdom projects)                                     |
| `npm run test:watch`                                               | Vitest in watch mode                                                                          |
| `npm run build`                                                    | typecheck + production build into `out/`                                                      |
| `npm run test:e2e`                                                 | Playwright Electron end-to-end tests against `out/` (run `npm run build` first)               |
| `npm run start`                                                    | `electron-vite preview`: runs the production build in `out/`                                  |
| `npm run build:mac` / `build:win` / `build:linux` / `build:unpack` | production build + electron-builder installers into `release/`                                |

### The `ELECTRON_RUN_AS_NODE` quirk

Shells launched from VS Code export `ELECTRON_RUN_AS_NODE=1`, which makes every Electron binary
(the app, `electron-vite dev/preview`, Playwright's `_electron`, electron-builder helpers) start
as plain Node and exit immediately. Every npm script that launches Electron already goes through
`scripts/with-electron-env.mjs`, which removes that variable. When you run Electron by hand,
prefix the command:

```sh
env -u ELECTRON_RUN_AS_NODE npx electron-vite build
env -u ELECTRON_RUN_AS_NODE npx electron .
```

## Where data lives

All user data is stored under Electron's `app.getPath('userData')`:

| Platform | Directory                                  |
| -------- | ------------------------------------------ |
| macOS    | `~/Library/Application Support/my-phd-os/` |
| Windows  | `%APPDATA%\my-phd-os\`                     |
| Linux    | `~/.config/my-phd-os/`                     |

Inside it: `my-phd-os.sqlite` (+ `-wal`/`-shm` while open) and `logs/main.log`. Settings › Data
shows the path and opens the directory. Two environment variables are honoured at startup:

- `MY_PHD_OS_USER_DATA=<dir>` overrides `userData` (used by every test so nothing touches the real
  directory).
- `MY_PHD_OS_E2E=1` disables the startup subscription refresh and any background network access.

The repository's `.gitignore` excludes databases, backups, imported/exported `.ics` files (except
`tests/fixtures/**`), build output, installers, logs, and e2e screenshots.

## Running the end-to-end tests

```sh
npm run build                 # produces out/
npm run test:e2e              # Playwright drives the built app
```

- Specs live in `tests/e2e/*.spec.ts`; `tests/e2e/helpers/launchApp.ts` launches `out/` with a fresh
  temporary `userData`, `MY_PHD_OS_E2E=1`, and collects renderer console messages and page errors.
  `launchApp({ userDataDir })` relaunches against an existing temp directory for persistence tests.
- `tests/e2e/visual.spec.ts` writes screenshots of every page in light and dark mode to
  `tests/e2e/__screenshots__/` (git-ignored) for manual inspection.
- `tests/e2e/shell.spec.ts` ends by asserting that the real `userData` directory was not modified.
- The e2e files are type-checked with `tsconfig.e2e.json` (DOM + Node types). In a spec, the
  Playwright page variable is named `page`; `window` inside `page.evaluate(...)` is the renderer's
  DOM global, typed through `src/preload/index.d.ts`.

Never leave `npm run dev` or a stray Electron process running when you finish; check with
`pgrep -fl electron`.

## Repository layout (short)

```
src/main       Electron main: window, menu, security (CSP, navigation), IPC registry + handlers,
               SQLite connection/migrations/repositories, logging
src/preload    contextBridge → window.api ({ invoke, on, off })
src/renderer   React app: shell (sidebar, top bar, palette, theme), pages, features, ui primitives
src/shared     Types, Zod schemas, IPC contract, dates/countdown/progress, deadline-status rules
tests          unit · integration · e2e · fixtures · setup
docs           ARCHITECTURE.md (contract + decisions log) · upstream-ccf-feed.md
```
