# Foundation API cheat sheet

Derived from the committed code on 2026-09-04. Every path, name and signature below was read from
the source; when this file and the code disagree, the code wins and this file must be fixed.
`docs/ARCHITECTURE.md` is the binding contract (ownership §3, conventions §6–§12); this document is
the "how do I call it" companion. Aliases: `@shared/*` → `src/shared/*` (main, preload, renderer,
tests), `@renderer/*` → `src/renderer/src/*` (renderer + renderer tests), `@main/*` → `src/main/*`
(node-project Vitest only; main source itself uses relative imports).

---

## 1. Renderer

### 1.1 `lib/api.ts` — the only module that touches `window.api`

```ts
import { api, onEvent, ApiError, isApiError } from '@renderer/lib/api'

const events = await api('calendar:listEvents', { rangeStart, rangeEnd }) // typed by channel
const bundle = await api('settings:get') // payload optional when schema accepts undefined
const off = onEvent('conferences:refreshStatus', (status) => {
  /* RefreshStatus */
}) // returns unsubscribe
```

- `api<N extends ChannelName>(channel, ...InvokeArgs<N>): Promise<ResponseOf<N>>`. Rejections are
  always `ApiError` (extends `AppError`; adds `channel: ChannelName`; `name === 'ApiError'`).
- `onEvent<E extends EventName>(event, listener): () => void` — events: `data:changed`,
  `conferences:refreshStatus`, `app:command`, `app:navigate` (payloads in `@shared/ipc/events`).
- Never call `window.api` elsewhere; never `fetch` in the renderer.

### 1.2 `lib/queryKeys.ts` — keys + invalidation map

```ts
queryKeys.app.{all, info()}
queryKeys.settings.{all, bundle(), dismissedWarnings()}
queryKeys.calendar.{all, events(filter?), event(id), sources()}
queryKeys.personalDeadlines.{all, list(filter?), detail(id)}
queryKeys.conferences.{all, subscriptions(), refreshStatus(), deadlines(filter?), deadline(id), followed(), changes(filter?)}
queryKeys.milestones.{all, list(), detail(id)}
queryKeys.habits.{all, list(filter?), detail(id), completions(filter?)}
queryKeys.data.{all, storageInfo()}
```

`filter` keys default to `{}` when omitted (`['calendar','events',{}]`), so pass the same object
shape from hook and invalidation. `ENTITY_INVALIDATION: Record<EntityName, QueryKeyPrefix[]>`:

| entity                                     | invalidates                                         |
| ------------------------------------------ | --------------------------------------------------- |
| calendarEvents, calendarSources            | `calendar.all`, `data.all`                          |
| personalDeadlines                          | `personalDeadlines.all`, `calendar.all`, `data.all` |
| conferenceSubscriptions, conferenceChanges | `conferences.all`, `data.all`                       |
| conferenceDeadlines, followedConferences   | `conferences.all`, `calendar.all`, `data.all`       |
| milestones                                 | `milestones.all`, `data.all`                        |
| habits, habitCompletions                   | `habits.all`, `data.all`                            |
| settings, dismissedWarnings                | `settings.all`                                      |

Adding feature keys: `queryKeys.ts` is integration-owned. Define extra keys **locally** in
`features/<x>/api.ts`, namespaced under the existing prefix so `data:changed` still invalidates them:

```ts
// features/timeline/api.ts
const warningKeys = { all: [...queryKeys.milestones.all, 'warnings'] as const } // prefix ['milestones'] → auto-invalidated
```

Typical hook pattern (all mutations get invalidation for free through `useDataChanged`, add
`onSuccess` invalidation only where feel matters):

```ts
export const useMilestones = () =>
  useQuery({ queryKey: queryKeys.milestones.list(), queryFn: () => api('milestones:list') })
export const useCreateMilestone = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMilestoneInput) => api('milestones:create', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.milestones.all }),
    onError: (error, input) => toastError(error, { retry: () => mutation.mutate(input) })
  })
}
```

### 1.3 `app/navigation.ts`

```ts
import {
  useNavigation,
  navigate,
  PAGES,
  getPage,
  isPageId,
  type PageDefinition,
  type NavigationParams
} from '@renderer/app/navigation'
const { page, params, navigate } = useNavigation() // zustand store
navigate('deadlines', { tab: 'personal', id }) // imperative, non-React
```

- `PageId = 'calendar' | 'deadlines' | 'timeline' | 'habits' | 'settings'` (from `@shared/types/settings`).
- `PageDefinition = { id, label, icon, shortcutIndex, createLabel?, createActionLabel? }`;
  `createActionLabel` is the top-bar button text (`Add Event`, `Add Deadline`, `Add Milestone`, `Create Habit`).
- Store: `{ page, params: Record<string,string>, hydrated, navigate(page, params = {}), hydrate(lastPage, launchPage), back() }`.
  `navigate` **replaces** params (not merge). `lastPage` is persisted via `persistUi` only after hydration and only on page change.
- Deep-link param conventions (§7): calendar `{ date, eventId }`, deadlines `{ tab: 'conference'|'personal', id }`,
  timeline `{ milestoneId }`, habits `{ habitId }`, settings `{ section: 'general'|'subscriptions'|'data'|'about' }`.
  Read them with `useNavigation((s) => s.params)`; unknown values must be ignored, not thrown.

### 1.4 `app/quickCreate.ts`

```ts
import {
  useRegisterQuickCreate,
  triggerQuickCreate,
  DEADLINES_QUICK_CREATE,
  notifyNothingToCreate
} from '@renderer/app/quickCreate'
useRegisterQuickCreate('timeline', openCreate) // handler must be a stable useCallback; effect re-registers on identity change
```

- `useRegisterQuickCreate(page: PageId, handler: () => void)` — `mod+N`, menu › New, top-bar button,
  palette `Create…` all call the handler of the **current** page.
- `triggerQuickCreate()` dispatches bus command `quick-create` `{ page }` first, then the registered
  handler; toasts `notifyNothingToCreate(page)` when neither exists.
- Deadlines page: `DEADLINES_QUICK_CREATE = { conference: 'conference-deadlines:quick-create', personal: 'personal-deadlines:quick-create' }`.
  `DeadlinesPage` already registers the page handler and forwards to the active tab; the tab
  components subscribe with `useCommandListener(DEADLINES_QUICK_CREATE.personal, openCreate)`.

### 1.5 `app/commands.ts` + `app/commandBus.ts` + `app/shortcuts.ts`

```ts
// app/commands.ts
export interface Command {
  id: string; title: string; group: string          // group = palette section heading (Navigate, Create, Calendar, Appearance, Settings, …)
  keywords?: string[]; shortcut?: string             // 'mod+K' style, rendered per platform
  icon?: LucideIcon
  when?: (ctx: { page: PageId }) => boolean          // hide in some contexts
  run: (ctx: CommandContext) => void | Promise<void> // ctx = { page, navigate(page, params?), close() }
}
export const useCommandPalette   // zustand { open, setOpen, toggle }
export const SETTINGS_SECTIONS   // [{id:'general'},{id:'subscriptions'},{id:'data'},{id:'about'}] + SettingsSectionId
export const shellCommands, useCommands(), groupCommands(commands)
```

Feature registration: fill the existing array in `features/<x>/commands.ts` (`calendarCommands`,
`conferenceDeadlineCommands`, `personalDeadlineCommands`, `timelineCommands`, `habitCommands`,
`settingsCommands`); `app/commands.ts` already spreads them. Ids should be `<feature>:<verb>`.

```ts
// app/commandBus.ts — synchronous in-renderer bus
type ShellCommandName = 'import-ics' | 'calendar-today' | 'close-overlay' | 'quick-create'
type FeatureCommandName = `${string}:${string}`            // e.g. 'calendar:export-ics'
subscribeCommand(name, (args: Record<string,string>) => void): () => void
dispatchCommand(name, args = {}): number                   // listeners notified (0 → fall back / toast)
useCommandListener(name, listener)                         // effect; listener must be stable (useCallback)
```

Shell dispatches: `import-ics` (palette, `mod+I`, menu — after navigating to calendar),
`calendar-today` (`T` on calendar page, palette), `quick-create` `{ page }`, `close-overlay` (`Esc`
when the palette is closed; return value 0 lets Radix handle Esc itself). Calendar must subscribe to
`import-ics` and `calendar-today` (the shell stub in `CalendarPage.tsx` does today).

```ts
// app/shortcuts.ts
runAppCommand(command: AppCommandId, args?)   // single dispatcher for menu (`app:command`), keyboard, palette
resolveShortcut(event, { page, paletteOpen })  // maps a keydown to SHORTCUTS entry (scope rules)
useGlobalShortcuts()                          // mounted once in App; also bridges `app:command` / `app:navigate`
```

Global shortcuts (`@shared/constants/shortcuts` `SHORTCUTS`): `mod+K` palette, `mod+N` quick-create,
`mod+I` import, `mod+,` settings, `mod+1…5` pages, `T` (calendar, not in inputs), `Esc`. Do not
re-bind these in features; use `useKeyboardShortcut` for feature-local keys.

### 1.6 Hooks (`@renderer/hooks/*`)

```ts
useNow({ precision?: 'minute' | 'second' } = {}): string          // ISO UTC; shared ticker; default minute
getNow(): string                                                  // latest tick, non-reactive
useFormat(): Formatters                                           // bound to settings + display zone
buildFormatters(settings: FormatSettings): Formatters             // pure; for tests / non-hook code
useSettings(): { settings, ui, isLoaded, error, refetch, updateSettings(patch), updateUi(patch), isSaving }
persistSettings(patch: UpdateSettingsInput): Promise<AppSettings | undefined>   // optimistic, toasts + rolls back on failure
persistUi(patch: UpdateUiStateInput): Promise<UiState | undefined>             // same; usable outside React
fetchSettings(): Promise<SettingsBundle>
useDataChanged()                                                  // mounted once in App — do not mount again
useKeyboardShortcut(key, handler, { mod?, shift?, ignoreInEditable? (default !mod), enabled? })
matchesShortcut(event, key, { mod?, shift? })
usePlatform() / getPlatform(): { isMac, isWindows, isLinux, modLabel: '⌘' | 'Ctrl' }
useMediaQuery(query: string): boolean
```

`Formatters` (every function takes ISO instants unless noted; `zone?: ZoneInput` overrides the display zone):

| member                                                             | output                                                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `settings`, `zone: ResolvedZone`, `zoneName`                       | `zoneName` = `System timezone (America/Vancouver)` or the setting label (`AoE`, `Europe/Paris`) |
| `formatDate(value, zone?)`                                         | `Sep 18, 2026` (system/iso/dmy/mdy); accepts `YYYY-MM-DD`, never zone-shifts it                 |
| `formatTime(instant, zone?)`                                       | `14:05` / `2:05 PM`                                                                             |
| `formatClock(instant, zone?)`                                      | `14:05:09` / `2:05:09 PM`                                                                       |
| `formatDateTime(instant, zone?)`                                   | `Sep 18, 2026 · 14:05` (all-day input → date only)                                              |
| `formatDateTimeWithZone(instant, zone?)`                           | `Sep 18, 2026 · 14:05 PDT`                                                                      |
| `formatZoneLabel(instant, zone?)`                                  | `PDT`, `AoE`, `UTC-12:00`, `UTC`                                                                |
| `formatWeekday(value, 'long'\|'short', zone?)`                     | `Thursday` / `Thu`                                                                              |
| `formatDateRange(startIso, endIso, { allDay?, endExclusive? })`    | `Sep 18, 2026 · 09:00–10:30`, `Sep 18 – Sep 20, 2026`                                           |
| `formatRelative(targetIso, nowIso)`                                | `in 3 days`, `2 hours ago`, `just now`                                                          |
| `formatCountdown(targetIso, nowIso, 'long'\|'compact'\|'stacked')` | see §3.1                                                                                        |
| `orderedWeekdays()`                                                | `[1..7]` or `[7,1..6]` (ISO, Monday = 1)                                                        |

Zone resolution: `settings.timezone` (`'system'` or any `resolveZone` input) → `tryResolveZone` →
fallback `resolveZone('system')`; `'system'` becomes the host IANA zone (`ianaName` set).
Components never import Luxon for display.

### 1.7 `components/common/*` (props)

| component              | props                                                                                                                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmptyState`           | `{ icon?: LucideIcon, title, description?: ReactNode, actions?: { label, onClick, variant?, icon? }[], variant?: 'default' \| 'compact', className? }` — `role="status"`; first action defaults to `default` button, others `outline`; compact = one-line row for right-panel sections |
| `ErrorState`           | `{ error?: unknown, title?, message?, onRetry?, retryLabel? = 'Retry', children?, variant?: 'default' \| 'compact', className? }` — `role="alert"`; derives title/message via `describeError`                                                                                          |
| `LoadingState`         | `{ label? = 'Loading…', variant?: 'spinner' \| 'skeleton' \| 'inline', rows? = 3, className? }`                                                                                                                                                                                        |
| `PageHeader`           | `{ title, subtitle?: ReactNode, actions?: ReactNode, children?: ReactNode, className? }` — children render below the title row (tabs/filters)                                                                                                                                          |
| `StatusBadge`          | `{ status: string \| StatusDefinition, size?: 'sm' \| 'md', hideIcon?, className? }` — resolves ids from milestone/personal/conference/deadline maps; unknown id → outline badge with raw text; adds `data-status`                                                                     |
| `CategoryChip`         | `{ category: CategoryId, marker?: 'dot' \| 'icon', tinted?: boolean, className? }` — `data-category`                                                                                                                                                                                   |
| `Countdown`            | `{ targetIso?: string, nowIso?: string, emphasizeUnder24h? = true, variant?: 'inline' \| 'stacked' \| 'large', className? }` — `targetIso` undefined → `TBD`; auto second-precision under 24 h; `data-countdown="tbd\|past\|urgent\|future"`; pass `nowIso` in tests                   |
| `ProgressBar`          | `{ value: number (0–100), label: string, indicatorClassName?, valueText?, size?: 'sm' \| 'md', className? }`                                                                                                                                                                           |
| `DualProgress`         | `{ timePercent, workPercent, paceDifference?, hidePace?, className? }` — two bars + legend + pace sentence (`describePace` in `pace.ts`)                                                                                                                                               |
| `ZonedTime`            | `{ instantIso, originalZone?: string, showLocal? = true, layout?: 'stacked' \| 'inline', className? }` — no `originalZone` → UTC + "(original timezone unavailable)"                                                                                                                   |
| `KeyboardHint`         | `{ shortcut: string ('mod+K'), className? }`                                                                                                                                                                                                                                           |
| `DynamicIcon`          | `{ name: string } & LucideProps` — lucide icon by constant name (`aria-hidden` by default)                                                                                                                                                                                             |
| `PendingFeatureDialog` | `{ open, onOpenChange, title, description }` — shell-phase stand-in; **remove from your pages** when the real flow lands                                                                                                                                                               |
| `ErrorBoundary`        | `{ children, fallback?(error, reset) }` — already wraps each page in `App`                                                                                                                                                                                                             |

Helpers: `statusLookup.ts` → `resolveStatus(idOrDef)`, `resolvePriority(id)`, `STATUS_DEFINITIONS_BY_ID`;
`pace.ts` → `describePace(points)` (`Exactly on pace`, `5 points ahead of pace`).

### 1.8 `components/ui/*` (shadcn-style, React 19 — `ref` is a plain prop)

| file                                                          | exports · notable props                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button.tsx` (+`button-variants.ts`)                          | `Button`, `ButtonProps`, `buttonVariants` · `variant: default \| secondary \| outline \| ghost \| destructive \| link`, `size: sm \| md \| lg \| icon`, `asChild` (via `slot.tsx` `Slot`); `type` defaults to `button`                                                                                          |
| `badge.tsx` (+`badge-variants.ts`)                            | `Badge`, `BadgeProps` · `variant: default \| secondary \| outline \| destructive \| status` (default secondary); `colorToken="status-ahead"` forces `status` variant + `chip-tint`                                                                                                                              |
| `input.tsx`, `textarea.tsx`, `label.tsx`                      | `Input` (supports `aria-invalid` styling), `Textarea`, `Label` (Radix)                                                                                                                                                                                                                                          |
| `select.tsx`                                                  | `Select`, `SelectGroup`, `SelectValue`, `SelectTrigger` (`size?: sm \| md`), `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`                                                                                                                                                                    |
| `switch.tsx`, `checkbox.tsx`, `slider.tsx`                    | `Switch`, `Checkbox` (`checked: boolean \| 'indeterminate'`), `Slider` (Radix; `value: number[]`)                                                                                                                                                                                                               |
| `segmented-control.tsx`                                       | `SegmentedControl<V>` `{ value, onValueChange, options: { value, label: ReactNode, ariaLabel?, icon? }[], 'aria-label' (required), size?, disabled?, className? }` — radiogroup semantics                                                                                                                       |
| `dialog.tsx`                                                  | `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent` (`size?: sm \| md \| lg \| xl`, `hideClose?`), `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`                                                                                                    |
| `alert-dialog.tsx`                                            | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction` (`variant?: default \| destructive`), `AlertDialogCancel` — use for every destructive confirm |
| `sheet.tsx`                                                   | `Sheet`, `SheetTrigger`, `SheetClose`, `SheetPortal`, `SheetOverlay`, `SheetContent` (`side?: top \| right \| bottom \| left`, default right, `sm:max-w-md`), `SheetHeader`, `SheetBody` (scrolls), `SheetFooter`, `SheetTitle`, `SheetDescription`                                                             |
| `tabs.tsx`                                                    | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (Radix)                                                                                                                                                                                                                                                        |
| `tooltip.tsx`                                                 | `TooltipProvider` (already in App), `Tooltip`, `TooltipTrigger`, `TooltipContent`                                                                                                                                                                                                                               |
| `popover.tsx`                                                 | `Popover`, `PopoverTrigger`, `PopoverAnchor`, `PopoverClose`, `PopoverContent` (w-72 default)                                                                                                                                                                                                                   |
| `dropdown-menu.tsx`                                           | `DropdownMenu`, `…Trigger`, `…Group`, `…Portal`, `…Sub`, `…RadioGroup`, `…Content`, `…Item` (`inset?`, `variant?: default \| destructive`), `…CheckboxItem`, `…RadioItem`, `…Label`, `…Separator`, `…Shortcut`, `…SubTrigger`, `…SubContent`                                                                    |
| `command.tsx`                                                 | `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandSeparator`, `CommandItem`, `CommandShortcut` (cmdk)                                                                                                                                                          |
| `card.tsx`                                                    | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`                                                                                                                                                                                                                               |
| `progress.tsx`                                                | `Progress` `{ value, 'aria-label'?, indicatorClassName?, size?: sm \| md }` — `role=progressbar`                                                                                                                                                                                                                |
| `scroll-area.tsx`, `separator.tsx`, `skeleton.tsx`, `kbd.tsx` | `ScrollArea`, `ScrollBar`; `Separator` (`orientation?`, `decorative? = true`); `Skeleton`; `Kbd`                                                                                                                                                                                                                |

Every icon-only `Button` needs `aria-label`. Missing primitive → build it inside `features/<x>/components` + `TODO(integration)`.

### 1.9 `lib/toast.ts`, `lib/log.ts`, `lib/icons.ts`, `lib/utils.ts`, `lib/shortcutLabel.ts`

```ts
toastError(error, { title?, retry?: () => void | Promise<unknown> })   // silent for AppError CANCELED; title from code (VALIDATION → 'Some values are invalid', …)
toastSuccess(title, description?)   toastInfo(title, description?)   describeError(error): { title, message }   toast (sonner re-export)
logError(message, error, context?)  // console.error + api('app:log') with { errorName, errorMessage } + bounded primitive context (≤20 keys, strings ≤500)
toLogContext(context)               // the bounding function, exported
ICONS_BY_NAME, iconByName(name): LucideIcon   // curated lucide map (names used by categories/statuses); unknown → Circle. Add names here only via TODO(integration); otherwise import lucide directly in your feature
cn(...classes)  chipStyle(colorToken): CSSProperties ({'--chip': 'var(--color-<token>)'})  isEditableTarget(target)  clampPercent(n): 0–100 rounded
shortcutKeys('mod+K', isMac): string[]   formatShortcutLabel('mod+K', isMac): '⌘K' | 'Ctrl+K'
```

Rule: every failed mutation → `toastError(error, { retry })`; background failures that would be
noise → `logError`. Never an empty `catch`.

### 1.10 Theme tokens (`styles/globals.css`, Tailwind 4 `@theme inline`)

Every token exists in light (`:root`) and dark (`.dark`) and is exposed as a Tailwind colour, so
`bg-*`, `text-*`, `border-*`, `ring-*` and opacity modifiers (`bg-status-ahead/15`) all work:

- Semantic: `background`, `foreground`, `card`, `card-foreground`, `popover(-foreground)`, `muted(-foreground)`,
  `accent(-foreground)`, `primary(-foreground)`, `secondary(-foreground)`, `destructive(-foreground)`,
  `border`, `input`, `ring`, `sidebar(-foreground)`, `elevated`.
- Categories: `category-course|coursework|research|meeting|deadline|work|health|personal|rest|paper|publication|scholarship|internship|academic|administrative|phd-progress|career|other`
  (`CategoryDefinition.colorToken` gives the exact token; `phd_progress` → `category-phd-progress`).
- Statuses: `status-ahead|on-track|behind|at-risk|urgent|completed|overdue|tbd|passed|neutral`.
- Priorities: `priority-low|medium|high|critical`. Progress bars: `progress-time`, `progress-work`.
- Radii `rounded-xs|sm|md|lg|xl`, shadows `shadow-xs|sm|md|lg`, fonts `font-sans|mono`, `animate-pulse-soft`.
- Utilities: `tabular` (tabular nums), `numeric` (mono + tabular), `chip-tint` / `chip-border` (read `--chip`;
  set it with `style={chipStyle(token)}`), `app-drag` / `app-no-drag`, `scrollbar-thin`.
- Dynamic token from data: `style={chipStyle(def.colorToken)}` + `className="chip-tint"` or `bg-(--chip)` / `text-(--chip)`.
  Hex colours stored on habits/sources (`#3b82f6`) go through inline `style`, not classes.
- Dark variant: `dark:` (`@custom-variant dark (&:where(.dark, .dark *))`). `prefers-reduced-motion` already kills animations.
  FullCalendar CSS variable overrides belong to the calendar feature (append in its own CSS file).

### 1.11 Test utilities

```ts
// renderer tests: src/renderer/**/*.test.tsx (jsdom project; setup tests/setup/renderer.ts runs automatically)
import { renderWithProviders } from '@renderer/test/renderWithProviders' // real QueryClient (cleared), ThemeProvider, TooltipProvider
import {
  windowApi,
  registerDefaultResponses,
  setMediaQuery,
  TEST_APP_INFO
} from '../../../../tests/setup/renderer' // relative path from your test
windowApi.respond('milestones:list', [milestone]) // static value …
windowApi.respond('milestones:create', (payload) => ({ ...payload, id: 'm1' })) // … or (payload) => value | Promise
windowApi.emit('data:changed', { entities: ['milestones'] }) // push an event to onEvent listeners
expect(windowApi.invoke).toHaveBeenCalledWith(
  'milestones:create',
  expect.objectContaining({ title })
)
```

- Setup registers defaults before each test (`settings:get`, `app:getInfo`, `app:log`, `settings:update`, `settings:updateUi`)
  and resets after; unregistered channels reject with `AppError('NOT_IMPLEMENTED')` — tests never pass on missing data.
- `createWindowApiMock()` (tests/setup/windowApiMock.ts) builds an isolated mock: `{ invoke: Mock, on, off, respond, emit, reset }`.
- `setMediaQuery('(prefers-color-scheme: dark)', true)` drives `matchMedia`; ResizeObserver / pointer-capture stubs are installed.
- Zustand stores are module singletons: reset them in `beforeEach` (`useNavigation.setState({ page: 'calendar', params: {}, hydrated: false })`).
- Node-project tests (`src/shared/**/*.test.ts`, `src/main/**/*.test.ts`, `tests/unit/**`, `tests/integration/**`): repositories run
  against a real file (`openDatabase(join(mkdtempSync(...), 'test.sqlite'))` + `runMigrations(db)`; see `tests/integration/database.test.ts`);
  subscribe to `changeBus` and call `changeBus.flush()` to assert emitted entities.
- Run: `npx vitest run <paths>`; typecheck `npm run typecheck`; lint `npx eslint <paths>`.

---

## 2. Main process

### 2.1 Repositories (`src/main/database/repositories/*`) — plain functions over `DatabaseSync`

All take `db` first, map rows via `rowToX`, throw `AppError('NOT_FOUND', …, { id })` from `getX`, return
`undefined` from `findX`, and call `changeBus.emit(...)` after every write (listed as → below).

| module                       | functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared.ts`                  | `prepared(db, sql)` (cached statements), `newId()`, `nowIso()`, `str/optStr/num/optNum/bool` (row readers), `toInt(bool)`, `orNull(v)`, `toJson(v)`, `fromJson<T>(v)`, `toStoredInstant(iso)` (→ `…Z`; `YYYY-MM-DD` passes through), `optStoredInstant`, `buildSet(columns)` → `{ clause, values }` (skips `undefined`), `notFound(entity, id)`, `countRows(db, table)`, `type Row`                                                                                                                                                                                       |
| `calendarEvents.ts`          | `listEvents(db, filter?)`, `findEvent`, `getEvent`, `createEvent(db, input)` → `calendarEvents`, `updateEvent(db, id, patch)` (re-validates `validateEventTimes`) → `calendarEvents`, `deleteEvent` → `EVENT_DELETE_ENTITIES` = `calendarEvents, personalDeadlines, followedConferences`, `rowToCalendarEvent`                                                                                                                                                                                                                                                            |
| `calendarSources.ts`         | `listSources`, `findSource`, `getSource`, `createSource` → `calendarSources`, `updateSource` → `calendarSources`, `deleteSource(db, id, deleteEvents)` → `calendarSources` + (`EVENT_DELETE_ENTITIES` or `calendarEvents`), returns `{ ok, deletedEvents }`                                                                                                                                                                                                                                                                                                               |
| `personalDeadlines.ts`       | `listPersonalDeadlines(db, { includeCompleted? })` (default hides completed), `findPersonalDeadline`, `getPersonalDeadline`, `createPersonalDeadline`, `updatePersonalDeadline(db, id, patch & { linkedCalendarEventId?: string \| null })` (re-validates window), `setPersonalDeadlineProgress`, `deletePersonalDeadline` → all `personalDeadlines`                                                                                                                                                                                                                      |
| `milestones.ts`              | `listMilestones`, `findMilestone`, `getMilestone`, `createMilestone`, `updateMilestone` → `milestones`; `deleteMilestone` → `milestones, personalDeadlines, calendarEvents`                                                                                                                                                                                                                                                                                                                                                                                               |
| `habits.ts`                  | `listHabits(db, { includeArchived? })`, `findHabit`, `getHabit`, `createHabit`, `updateHabit`, `setHabitArchived(db, id, archived)` → `habits`; `deleteHabit` → `habits, habitCompletions`                                                                                                                                                                                                                                                                                                                                                                                |
| `habitCompletions.ts`        | `listCompletions(db, { from, to, habitId? })` (inclusive date keys), `findCompletion(db, habitId, date)`, `setCompletion(db, habitId, date, completed)` (upsert) → `habitCompletions`                                                                                                                                                                                                                                                                                                                                                                                     |
| `conferenceSubscriptions.ts` | `listSubscriptions`, `findSubscription`, `findSubscriptionByUrl`, `getSubscription`, `createSubscription(db, { url, label, kind, language?, filters?, customConfirmedAt? })` (CONFLICT on duplicate URL), `updateSubscription(db, id, { enabled?, label? })`, `recordFetchState(db, id, { etag?, lastModified?, contentHash?, lastSuccessAt?, lastAttemptAt?, lastError? })` (null clears) → `conferenceSubscriptions`; `removeSubscription` → `conferenceSubscriptions, conferenceDeadlines, followedConferences, conferenceChanges`, returns `{ ok, removedDeadlines }` |
| `conferenceDeadlines.ts`     | `listConferenceDeadlines(db, filter?)` (view: `subscriptionLabel`, `followed?`), `listFollowedDeadlines`, `listDeadlinesBySubscription(db, subscriptionId)`, `findConferenceDeadline`, `getConferenceDeadline`, `getConferenceDeadlineView`, `upsertConferenceDeadline(db, input: ConferenceDeadlineInput, seenAt?)` (key `(subscriptionId, stableKey)`, preserves `firstSeenAt`), `setConferenceDeadlineStatus(db, id, status, deadlineAt?)` → `conferenceDeadlines`; `deleteConferenceDeadline` → `conferenceDeadlines, followedConferences, conferenceChanges`         |
| `conferenceSnapshots.ts`     | `findSnapshot(db, subscriptionId)`, `saveSnapshot(db, { subscriptionId, contentHash, fetchedAt, etag?, lastModified?, rawText })`, `deleteSnapshot` — **no** changeBus emit                                                                                                                                                                                                                                                                                                                                                                                               |
| `followedConferences.ts`     | `listFollows`, `findFollow`, `getFollow`, `followConference(db, id, intention?)` (idempotent), `updateFollow(db, id, { intention?, progress?, notes?, calendarEventId?: string \| null })`, `unfollowConference` → `followedConferences`                                                                                                                                                                                                                                                                                                                                  |
| `conferenceChanges.ts`       | `listConferenceChanges(db, { unacknowledgedOnly?, followedOnly? })` (view: `conferenceTitle`, `followed`), `recordConferenceChange(db, { conferenceDeadlineId, field, previousValue, currentValue, upstreamSnapshotHash, detectedAt? })`, `acknowledgeConferenceChanges(db, ids)` → `conferenceChanges`                                                                                                                                                                                                                                                                   |
| `settings.ts`                | `getSettings`, `getUiState`, `getSettingsBundle`, `patchSettings`, `patchUiState` → `settings`; `readJsonSetting/writeJsonSetting(db, 'app'\|'ui'\|'window', …)`, `getWindowState/setWindowState` (no emit)                                                                                                                                                                                                                                                                                                                                                               |
| `dismissedWarnings.ts`       | `listDismissedWarnings`, `findDismissedWarning`, `dismissWarning(db, key, payload?)` (upsert), `restoreWarning`, `clearDismissedWarnings` → `dismissedWarnings`                                                                                                                                                                                                                                                                                                                                                                                                           |
| `maintenance.ts`             | `ENTITY_TABLES`, `USER_TABLES`, `dataCounts(db): DataCounts`, `clearAllUserData(db)` (keeps `window` setting + `schema_migrations`) → all `ENTITY_NAMES`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `appMeta.ts`                 | `getMeta/setMeta/listMeta`, `recordLaunch(db, version, now)` (`installedAt`, `lastLaunchedAt`, `lastLaunchedVersion`)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

`connection.ts`: `openDatabase(path)`, `closeDatabase(db)`, `transaction(db, fn)` (BEGIN/COMMIT/ROLLBACK),
`DATABASE_FILE_NAME`. `changeBus.ts`: `changeBus.emit(...entities)`, `.flush()`, `.subscribe(listener)`, `.pendingEntities` (30 ms debounce, deduplicated).

### 2.2 Handlers (`src/main/ipc/handlers/<feature>.ts`)

```ts
import * as repo from '../../database/repositories/milestones'
import type { Handlers } from '../registry'
import { OK, notImplemented } from './shared'

export const milestoneHandlers = {
  'milestones:list': (_request, ctx) => repo.listMilestones(ctx.db), // request already Zod-validated (RequestOf<N>)
  'milestones:delete': ({ id }, ctx) => {
    repo.deleteMilestone(ctx.db, id)
    return OK
  },
  'x:notYet': () => notImplemented('Feature label') // throws AppError NOT_IMPLEMENTED — replace inside your file
} satisfies Partial<Handlers> // handlers/index.ts is typed `Handlers` → every channel must exist
```

- `HandlerContext = { db (getter; throws the startup AppError when unavailable), window: BrowserWindow | null, paths: DataPaths, dbError?, reopenDatabase(), now(): string }`.
  `DataPaths = { userData, databasePath, logsDir, logPath }`.
- Return sync or `Promise`. Throw `new AppError(code, message, details?)`; anything else becomes `INTERNAL`.
  Put only allow-listed keys in `details` if you want them logged (§2.4).
- Registry (`registry.ts` `registerHandlers(contract, handlers, ctxFactory, options?)`): rejects untrusted senders
  (`PERMISSION`), validates with `definition.request.safeParse` (`VALIDATION` with `details.issues[{path,message,code}]`),
  wraps thrown values into `{ __ipcError: IpcError }` (`IPC_ERROR_KEY` from `@shared/ipc/envelope`) and logs via `logAppError`.
  The preload turns the envelope into a rejection; `lib/api.ts` turns it into `ApiError`.
- New channel = add to your `src/shared/ipc/channels/<feature>.ts` + handler in your handlers file; `contract.ts` / `handlers/index.ts` spread them.

### 2.3 Filesystem and dialogs

```ts
import { pickFiles, pickSavePath } from '../../filesystem/dialogs'
const picked = await pickFiles(ctx.window, { title, filters: [{ name: 'iCalendar', extensions: ['ics'] }], multiple?: true, defaultPath? })
// → DialogResult<{ paths: string[] }>  ==  { canceled: true } | { canceled: false, paths }
const target = await pickSavePath(ctx.window, { title, filters, defaultPath? })   // → DialogResult<{ path }>
```

Cancel is a value, never an error. `dataDirectory.ts`: `getDataPaths()`, `openDataDirectory(paths)`.
`security/openExternal.ts`: `validateExternalUrl(input): URL` (http/https only), `openExternalUrl(input)`.
File reads/writes belong in your owned `filesystem/<x>.ts`; throw `AppError('IO', …, { path })` on failure.

### 2.4 Logging (`src/main/logging/logger.ts`)

`logger` (electron-log; `userData/logs/main.log`, 5 MB rotation, level `info`), `logAppError(scope, error): IpcError`
(expected codes `VALIDATION | NOT_FOUND | CONFLICT | CANCELED | NOT_IMPLEMENTED` → `warn`, else `error` + stack),
`sanitizeDetails(details)` keeps only primitive values under `id, ids, code, count, version, name, path, table, channel, field, host, url, status, reason, issues, entity`
(arrays collapse to `[n items]`); `sanitizeRendererContext` bounds `app:log` context (≤20 keys, strings ≤500).
Never log titles, descriptions, notes or raw feed text.

### 2.5 Migrations

```ts
// src/main/database/migrations/010_calendar_import_meta.ts   (NNN = your range: calendar 010–019, conferences 020–029,
//   personal-deadlines 030–039, timeline 040–049, habits 050–059, settings-data 060–069)
import type { Migration } from './types'
export const calendarImportMetaMigration: Migration = {
  version: 10,
  name: 'calendar_import_meta',
  sql: `ALTER TABLE ...;`
}
// then append to migrations/index.ts:  export const migrations = [initialMigration, calendarImportMetaMigration]
```

`runMigrations(db, migrations?)` applies pending versions ascending, one transaction each, records in
`schema_migrations`; duplicates or failures → `AppError('MIGRATION_FAILED')`; the file is never recreated.
`migrations/index.ts` is the one shared file feature agents may append to (append only; never reorder).
Schema today (001): `settings`, `app_meta`, `calendar_sources`, `calendar_events`, `personal_deadlines`, `milestones`,
`conference_subscriptions`, `conference_snapshots`, `conference_deadlines`, `followed_conferences`,
`conference_deadline_changes`, `habits`, `habit_completions`, `dismissed_warnings`. Booleans INTEGER 0/1, JSON as TEXT `*_json`.

### 2.6 Env flags and the scheduler hook

`src/main/env.ts`: `isDev`, `isE2E` (`MY_PHD_OS_E2E=1` → no startup refresh / background network), `userDataOverride`
(`MY_PHD_OS_USER_DATA`, unpackaged only), `rendererDevUrl`, `ignoredRendererUrlReason`, `isLocalDevServerUrl(url)`.
Hook point in `src/main/index.ts` `bootstrap()` after `createWindow()`:

```ts
if (isE2E) logger.info('[app] E2E mode: startup subscription refresh disabled')
// Startup refresh of conference subscriptions is wired by the conferences feature
// (src/main/subscriptions/scheduler.ts) and must honour `isE2E` and `settings.refreshOnLaunch`.
```

`index.ts` is not feature-owned: build the scheduler as an exported `installSubscriptionScheduler({ db, settings, broadcast, isE2E })`
in `src/main/subscriptions/scheduler.ts` and leave a `TODO(integration): call installSubscriptionScheduler(...) in index.ts`.
Push events from main use `window.webContents.send(event, payload)` (`broadcast` helper in `index.ts` is private; the
conferences feature needs `conferences:refreshStatus` broadcasting — request it the same way).

---

## 3. Shared (`src/shared`)

### 3.1 `dates/*` (barrel `@shared/dates`)

| function                                                                                                                                                    | semantics                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveZone(input: string \| ResolvedZone): ResolvedZone`                                                                                                  | `'system'`, IANA, `UTC`, `AoE` (UTC−12), `PT/ET/CT/MT`, `UTC-8`, `UTC+05:30`, `GMT+8`; unknown → `AppError VALIDATION`. `ResolvedZone = { kind: 'iana'\|'fixed'\|'utc', luxonZone, label, ianaName?, offsetMinutes? }` |
| `tryResolveZone(input)` / `isValidZoneInput(input)`                                                                                                         | non-throwing variants                                                                                                                                                                                                  |
| `formatOffset(minutes)` / `systemZoneName()` / `ZONE_ALIASES`, `AOE_LABEL`, `AOE_OFFSET_MINUTES`                                                            | `UTC+08:00`; host IANA name                                                                                                                                                                                            |
| `nowIso()`                                                                                                                                                  | `new Date().toISOString()`                                                                                                                                                                                             |
| `parseInstant(iso): DateTime` / `isValidInstant(v)`                                                                                                         | throws VALIDATION on invalid                                                                                                                                                                                           |
| `toZonedDateTime(iso, zone)`                                                                                                                                | Luxon DateTime in zone                                                                                                                                                                                                 |
| `wallTimeToInstant('2026-09-18T23:59', zone): string`                                                                                                       | wall time in zone → UTC `…Z` (offset/Z input treated as absolute)                                                                                                                                                      |
| `instantToWallTime(iso, zone): WallTime`                                                                                                                    | `{ localIso 'YYYY-MM-DDTHH:mm:ss', date, time 'HH:mm', offsetMinutes, zoneLabel }`                                                                                                                                     |
| `zoneLabelAt(zone, dt)`                                                                                                                                     | `PDT` for IANA, label for fixed                                                                                                                                                                                        |
| `compareInstants(a, b): number`                                                                                                                             | millis difference                                                                                                                                                                                                      |
| `calculateRemainingTime(targetIso, nowIso): RemainingTime`                                                                                                  | `{ totalMs, isPast, isUnder24h, days, hours, minutes, seconds }`                                                                                                                                                       |
| `countdownSegments(remaining): { value, unit, label }[]`                                                                                                    | days/hours/minutes, or hours/minutes/seconds under 24 h                                                                                                                                                                |
| `formatCountdown(remaining, { style })`                                                                                                                     | long `32 days 08 hours 14 minutes`; compact `32d 08h` / `08h 14m` / `14m 09s`; stacked (newline-joined); past `Passed 2 days ago` / `Passed just now`                                                                  |
| `formatRelative(targetIso, nowIso)`                                                                                                                         | `in 3 days`, `5 minutes ago`, `just now`                                                                                                                                                                               |
| `MS_PER_SECOND/MINUTE/HOUR/DAY`                                                                                                                             | constants                                                                                                                                                                                                              |
| `calculateTimeProgress(startIso, deadlineIso, nowIso): { raw, clamped }`                                                                                    | start ≥ deadline → `1`                                                                                                                                                                                                 |
| `calculatePaceDifference(workPercent, timeClamped)`                                                                                                         | `work − time×100` (points)                                                                                                                                                                                             |
| `formatDate/formatTime/formatDateTime/formatDateTimeWithZone/formatZoneLabel/formatDateRange/formatWeekday/orderedWeekdays(…, settings: FormatSettings, …)` | the pure versions behind `useFormat`                                                                                                                                                                                   |
| `isAllDayDate(v)`                                                                                                                                           | `YYYY-MM-DD` and a real date                                                                                                                                                                                           |
| `addDays(date, n)`, `diffDays(a, b)`, `compareDateKeys(a, b)`, `weekdayOfDate(date)` (ISO 1–7)                                                              | pure calendar arithmetic, no zone                                                                                                                                                                                      |
| `dateKeyInZone(iso, zone)`, `todayInZone(zone, nowIso)`, `startOfDayInZone(date, zone)`                                                                     | the only date↔zone bridges                                                                                                                                                                                             |

### 3.2 `deadline-status/*`

`calculateDeadlineStatus(deadline: Pick<PersonalDeadline,'trackingStartAt'|'deadlineAt'|'progress'|'status'>, nowIso, thresholds?)`
→ `{ status: DeadlineStatus, timeProgress, paceDifference, remaining }`. Order: `completed → overdue → urgent → at_risk → behind → ahead → on_track`.
`DEADLINE_STATUS_THRESHOLDS = { URGENT_WINDOW_HOURS: 24, URGENT_PROGRESS_CEILING: 90, AT_RISK_GAP: 20, BEHIND_GAP: 8, AHEAD_GAP: 10 }`.
Computed `DeadlineStatus` ≠ stored `PersonalDeadlineStatus` (`not_started | in_progress | completed | missed`).

### 3.3 `constants/*` (barrel `@shared/constants`)

- `categories.ts`: `CATEGORIES: Record<CategoryId, { id, label, colorToken, icon }>`, `CATEGORY_IDS`, `getCategory(id)`,
  `CALENDAR_CATEGORY_OPTIONS`, `PERSONAL_DEADLINE_CATEGORY_OPTIONS`, `MILESTONE_CATEGORY_OPTIONS`, `type CategoryId`.
- `statuses.ts`: `StatusDefinition<Id> = { id, label, icon, colorToken }`; maps `DEADLINE_STATUS_DEFINITIONS`,
  `PERSONAL_DEADLINE_STATUS_DEFINITIONS`, `PRIORITY_DEFINITIONS`, `CONFERENCE_STATUS_DEFINITIONS`, `MILESTONE_STATUS_DEFINITIONS`,
  `ICS_IMPORT_ITEM_STATUS_DEFINITIONS` (`new|duplicate|conflict|invalid`), `ICS_DUPLICATE_REASON_LABELS`, `REFRESH_OUTCOME_DEFINITIONS`.
- `timezones.ts`: `TIMEZONE_OPTIONS: { group, options: { id, label }[] }[]` (`system` first), `TIMEZONE_OPTION_IDS`.
- `ccf.ts`: `CCF_SUBJECTS`, `CCF_SUBJECT_BY_CODE`, `isCcfSubjectCode`, `CCF_RANK_OPTIONS/CORE_RANK_OPTIONS/THCPL_RANK_OPTIONS` (`{ value, label, urlSegment }`),
  `encodeRankForUrl('A*') → 'Astar'`, `FILTER_ORDER = ['ccf','core','thcpl','subject']`, `SUBSCRIPTION_LANGUAGE_LABELS`.
- `hosts.ts`: `APPROVED_SUBSCRIPTION_HOSTS`, `OFFICIAL_FEED_BASE`, `OFFICIAL_FEED_URLS.{en,zh}`, `CCF_DEADLINES_HOMEPAGE/REPOSITORY`, `isApprovedSubscriptionUrl(url)`.
- `emptyStates.ts`: `EMPTY_STATES.{calendar, conferenceDeadlinesNoSubscription, conferenceDeadlinesNotLoaded, personalDeadlines, timeline, habits, todayEvents, nextEvent, nearestDeadline, todayHabits}` each `{ title, description?, actions: string[] }` — use these strings verbatim.
- `shortcuts.ts`: `AppCommandId`, `Shortcut`, `SHORTCUTS`, `PAGE_SHORTCUT_ORDER`.

### 3.4 Schemas (`@shared/schemas`, Zod 4) and types (`@shared/types`)

Naming: `<entity>Schema` (full row), `create<Entity>InputSchema` (omit id/timestamps, `.default()`s, cross-field
`superRefine`/`refine`), `update<Entity>InputSchema` (`.partial()`), `<verb>RequestSchema` for channel payloads, `type Create<Entity>Input = z.input<…>`
(what the renderer sends; defaults optional), `type Update<Entity>Input = z.infer<…>`. Common building blocks in `schemas/common.ts`:
`isoInstantSchema` (Z or offset), `isoDateSchema`, `instantOrDateSchema`, `idSchema`, `idListSchema`, `titleSchema` (trim, 1–500), `longTextSchema` (≤20k),
`shortTextSchema` (≤1k), `timezoneSchema` (validated by `resolveZone`), `colorSchema` (hex), `percentSchema` (0–100), `httpUrlSchema`, `tagsSchema`,
`emptyRequestSchema = z.undefined()`, `idRequestSchema`, `patchRequest(schema)` → `{ id, patch }`, `okResponseSchema`.
Cross-field helpers exported for repositories: `validateEventTimes({ allDay, startAt, endAt })`, `isValidDeadlineWindow`, `DEADLINE_WINDOW_MESSAGE`.
Types mirror spec: `CalendarEvent`, `CalendarSource`, `PersonalDeadline`, `Milestone`, `Habit`, `HabitCompletion`, `ConferenceSubscription`,
`ConferenceDeadline(+View)`, `FollowedConference`, `ConferenceDeadlineChange(+View)`, `RefreshStatus`, `RefreshOutcome`, `AppSettings`/`DEFAULT_SETTINGS`,
`UiState`/`DEFAULT_UI_STATE`, `SettingsBundle`, `DismissedWarning`, `AppInfo`, `StorageInfo`, backup types, `DialogResult<T>`, `OkResponse`, `DataCounts`,
const arrays (`CALENDAR_VIEWS`, `PAGE_IDS`, `DEADLINES_TABS`, `PERSONAL_DEADLINES_VIEWS = cards|list|timeline`, `TIMELINE_VIEWS = semester|year|multiYear|list`, …).

### 3.5 IPC contract, events, errors

```ts
// src/shared/ipc/channels/<feature>.ts — the only place a feature adds channels
import { defineChannel } from '../defineChannel' // NOT from contract.ts (cycle)
export const habitChannels = {
  'habits:list': defineChannel<typeof listHabitsRequestSchema, Habit[]>(
    'habits:list',
    listHabitsRequestSchema
  )
}
// contract.ts: channels = { ...appChannels, ...settingsChannels, ...calendarChannels, ...personalDeadlineChannels,
//   ...conferenceChannels, ...milestoneChannels, ...habitChannels, ...dataChannels } satisfies Contract
// types: ChannelName, RequestOf<N> (z.output), RequestInputOf<N> (z.input), ResponseOf<N>, InvokeArgs<N>,
//        ChannelHandlers<Ctx>, WindowApi, channelNames, isChannelName
```

Channel names are `domain:verb` camelCase. Existing channels per feature: see the channel files; the NOT_IMPLEMENTED ones are
`calendar:pickIcsFiles|previewIcsImport|commitIcsImport|exportIcs`, `conferences:refresh|addToCalendar|removeFromCalendar`,
`personalDeadlines:linkCalendarEvent|unlinkCalendarEvent`, `data:exportBackup|previewBackupImport|commitBackupImport`.
Events (`ipc/events.ts`): `ENTITY_NAMES`/`EntityName`, `EventPayloads`, `EVENT_NAMES`, `isEntityName`, `isEventName`. Adding an event
name requires editing `events.ts` (shared foundation) → `TODO(integration)`.
Errors (`errors.ts`): `class AppError(code, message, details?)`, `isAppError`, `isIpcError`, `toIpcError`, `fromIpcError`,
codes `VALIDATION NOT_FOUND CONFLICT NOT_IMPLEMENTED IO NETWORK TIMEOUT INVALID_URL UNTRUSTED_HOST INVALID_ICS INVALID_BACKUP UNSUPPORTED_BACKUP_VERSION MIGRATION_FAILED CANCELED PERMISSION INTERNAL`.

---

### 3.6 `ics/*`, `conferences/*`, `backup/*`, `personal-deadlines/*`, `timeline/*`, `habits/*`

- `ics/parse.ts` — `parseIcsFiles(files, { appZone }) → { files: ParsedIcsFile[], invalidFiles }`,
  `parsedDateRange`; `ics/duplicates.ts` — `detectDuplicates(incoming, existing, targetSourceId?)`
  (reasons `uid → recurrenceId → startInstant → source`); `ics/serialize.ts` — `serializeIcs(events,
{ calendarName, nowIso })`, `foldLine`, `exportUid`.
- `conferences/*` — `buildSubscriptionUrl / buildSubscriptionFileName / parseSubscriptionUrl /
describeFilters`, `stableKey`, `parseConferenceFeed`, `compareSnapshots` (+ `CONFERENCE_CHANGE_LABELS`),
  `buildConferenceEventInput`, and `views.ts` (`filterConferenceDeadlines`, `sortConferenceDeadlines`,
  `collectFacets`, `groupConferenceRounds`, `nearestFollowedDeadline`, `followedTimeProgress`,
  `changeHeadline / changeLabel / changeValueText / sortChanges / updatedDeadlineIds`).
- `backup/format.ts` + `backup/validate.ts` — the JSON backup envelope and its validation.
- `personal-deadlines/views.ts` (`describeDeadlines`, `filterDeadlines`, `sortDeadlines`,
  `collectTags`, `nearestUpcomingDeadline`, `summarizeDeadlines`) and `calendarLink.ts`.
- `timeline/rules.ts` + `detectTimelineWarnings.ts`; `habits/streaks.ts`.

Renderer-side calendar helpers live in `features/calendar/lib` (`expandOccurrences(events, range,
zone)`, `toFcEvents`, `applyOccurrenceFilters`, recurrence drafts) because they depend on FullCalendar
types; everything in `src/shared` stays framework-free.

## 4. Gotchas (read before coding)

1. **Instants are ISO UTC ending in `Z`** in the database (`2026-09-18T11:59:00.000Z`); the schema accepts offsets and the
   repositories normalise via `toStoredInstant`. Build instants from user wall time with `wallTimeToInstant(localIso, zone)` and store the zone string separately.
2. **All-day dates are `YYYY-MM-DD`** everywhere (`CalendarEvent.startAt/endAt` when `allDay`, `HabitCompletion.date`, `listCompletions` bounds,
   `calendar:listEvents` range bounds). They never pass through a zone; `formatDate` detects them. All-day event `endAt` is exclusive.
3. `calendar:listEvents` bounds: timed rows compare against the UTC-normalised bound, all-day rows against `bound.slice(0,10)`.
   Send bounds in the display offset (or date keys) for exact all-day cuts; recurring masters starting before `rangeEnd` are always returned for renderer expansion.
4. **Payload-less channels** validate `z.undefined()`: call `api('settings:get')` with no second argument. Filters that are wholly optional
   (`calendar:listEvents`, `personalDeadlines:list`, `habits:list`, `conferences:refresh|listDeadlines|listChanges`) accept `undefined` too.
5. **Update channels** take `{ id, patch }`; the repositories re-validate cross-field rules on the merged row and throw `VALIDATION { id, field }`.
   Optional fields are cleared with `null` (ARCHITECTURE Decision 49); `undefined` leaves them untouched.
6. **UI state persistence**: `ui` (`lastPage`, `calendarView`, `sidebarCollapsed`, `deadlinesTab`, `personalDeadlinesView`, `timelineView`) lives in
   the `settings` table key `ui`. Read with `useSettings().ui`, write with `updateUi(patch)` / `persistUi(patch)` (optimistic, toasts on failure).
   Never seed the cache before the first `settings:get`; never mirror server state in zustand.
7. **Settings hydration**: `AppGate` blocks until `app:getInfo` and `settings:get` settle; `useSettings().isLoaded` is false until then and defaults are shown.
   Feature hooks may assume the QueryClient is populated with the settings bundle when a page mounts.
8. **DeadlinesPage wiring**: `DeadlinesPage.tsx` (integration-owned) renders `<DeadlineSummary />` (returns `null` today) then
   `<Tabs value={tab}>` with `ConferenceDeadlinesTab` / `PersonalDeadlinesTab`. Tab comes from `params.tab` (deep link) else `ui.deadlinesTab`; it
   registers the page quick-create and forwards to `DEADLINES_QUICK_CREATE[tab]`. Tabs must subscribe with `useCommandListener` and never edit the page.
9. **Stub files to replace** (keep the export name and the default `EmptyState` copy):
   - calendar → `pages/CalendarPage.tsx` (default export `CalendarPage`; currently `useCommandListener('import-ics')`, `useRegisterQuickCreate('calendar')`,
     `PendingFeatureDialog`, and the right panel composing `PersonalDeadlineCompact`, `FollowedConferenceCompact`, `TodayHabitsCompact` — keep that panel).
   - conferences → `features/conference-deadlines/components/{ConferenceDeadlinesTab, FollowedConferenceCompact, SubscriptionManager}.tsx`
     (`SubscriptionManager` is also rendered by `features/settings/components/ConferenceSubscriptionsSection.tsx`).
   - Done: personal-deadlines, timeline, habits and settings-data are real (see their `features/<x>/README.md`).
   - every `features/<x>/api.ts` is `export {}` with the expected hook names in a comment; every `features/<x>/commands.ts` exports an empty `Command[]`.
10. **Compact components have no props today**; when you add props keep them optional so `CalendarPage` (owned by calendar) still compiles.
11. **`StatusBadge` accepts status ids as strings** across all maps; ids shared between maps (`completed`, `not_started`, `in_progress`) have identical definitions.
    Priorities are not in the merged map — use `resolvePriority(id)` and `<Badge colorToken={def.colorToken}>` or `StatusBadge status={def}`.
12. **Icons by name** must exist in `lib/icons.ts` `ICONS_BY_NAME` (category/status icons do). For your own UI import lucide components directly.
13. **`useCommandListener` / `useRegisterQuickCreate` re-subscribe when the handler identity changes** — wrap handlers in `useCallback`.
14. **`Countdown` with `targetIso` undefined renders `TBD`** (conference deadlines with `status === 'tbd'` have no `deadlineAt`). Never invent a date.
15. **CCF feed UIDs are random per generation**; identity is `stableKey` (`docs/upstream-ccf-feed.md`). `conferences:getRefreshStatus` currently derives
    everything from `last_*` columns and reports `inProgress: false`.
16. **`clearAllUserData` emits every entity**, so all feature queries refetch after Settings › Data › Clear.
17. **Deleting a milestone emits `personalDeadlines` and `calendarEvents`**, deleting an event emits `personalDeadlines` and `followedConferences`
    (FK `ON DELETE SET NULL`); rely on `data:changed` rather than manual cross-feature invalidation.
18. **Test paths**: renderer tests must live under `src/renderer/**` as `*.test.tsx` to get the jsdom project + `window.api` mock; node tests go in
    `src/shared/**`, `src/main/**`, `tests/unit/**`, `tests/integration/**` (`tests/unit/<feature>*.test.ts`, `tests/fixtures/<feature>/`).
19. **Do not import `tests/setup/renderer.ts` from non-test code**, and do not import `@renderer/test/renderWithProviders` outside `*.test.tsx`.
20. Menu accelerators arrive as `app:command` with `AppCommandId` (`quickCreate`, `importIcs`, `openSettings`, `goToPage`, `openCommandPalette`, `calendarToday`, `closeOverlay`);
    they already route through `runAppCommand`, so a feature only needs the bus subscription, never its own IPC listener.
