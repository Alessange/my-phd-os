You are a senior desktop application engineer, frontend engineer, interaction designer, and data-visualization designer.

Design and implement a complete standalone desktop application for visually managing a PhD student’s calendar, deadlines, long-term timeline, and habits.

The working title is:

My PhD OS

This is not a website, a browser-only web app, a conventional to-do list, or an enterprise project-management system.

It must be a real standalone desktop application that can be installed and launched like a normal application. The first version should run entirely on the user’s computer and should not require a browser, a cloud account, a remote backend, or a locally running web server after packaging.

The product should help the user immediately understand:

What is happening today and this week;
Which deadlines are approaching;
Exactly how much time remains;
Which conferences the user is following;
How far the user has progressed on personal deadlines;
Where the user currently is within a semester or multi-year plan;
Which habits should be completed today.

The core product value is visualization. Use calendars, countdowns, progress bars, time bars, timeline tracks, status indicators, and restrained charts to compress a complicated PhD life into a focused visual interface.

Before implementing anything, inspect the current repository. If it is empty, initialize the project and start building immediately. Do not repeatedly ask ordinary design questions. Make reasonable product and engineering decisions unless a genuinely blocking issue exists.

1. Product Scope

The application must include these primary pages in the following sidebar order:

Calendar
Deadlines
Timeline
Habits
Settings

The default page must be Calendar.

Do not create a separate generic Dashboard page. Calendar should also provide a concise overview of today, upcoming deadlines, and today’s habits.

The application must support two different kinds of deadlines:

Conference Deadlines
Automatically retrieved from official CCF Deadlines .ics subscriptions.
Personal Deadlines
Manually created and fully managed by the user.

These two types must remain conceptually and structurally separate.

2. Desktop Application Requirement

Build a standalone Electron desktop application.

Use:

Electron
electron-vite
React
TypeScript
Tailwind CSS
shadcn/ui or Radix primitives
FullCalendar
Recharts where charts are genuinely useful
ical.js
Luxon, Temporal polyfill, or another reliable timezone-aware library
Vitest
Playwright with Electron support for critical end-to-end flows
electron-builder for packaging

The packaged application must:

Launch from a normal desktop icon;
Open its own native application window;
Not open inside the user’s normal browser;
Not require localhost;
Not require a separately launched server;
Not require Docker;
Not require Python;
Not require a cloud database;
Not require a remote backend;
Continue to work offline except when refreshing conference subscriptions;
Preserve all user data after closing and reopening the application.

During development, normal development tooling may use a Vite development server. However, the packaged production application must load bundled local assets and require no running development process.

Prepare packaging for:

macOS .dmg or .app;
Windows .exe installer;
Linux AppImage if practical.

Prioritize reliable macOS and Windows builds.

Do not spend time on:

GitHub Pages;
Static website hosting;
HashRouter workarounds;
GitHub Actions deployment;
Web-domain configuration;
Cloud synchronization.
3. Electron Architecture and Security

Use a secure Electron architecture:

Electron main process for filesystem access, network fetching, window management, native dialogs, and persistence;
Preload script using contextBridge;
React renderer for the user interface;
contextIsolation: true;
nodeIntegration: false;
Renderer sandboxing where compatible;
A narrow, typed IPC API;
Validate all IPC input in the main process;
Do not expose arbitrary filesystem or shell access to the renderer;
Add an appropriate Content Security Policy;
Open external links through shell.openExternal after validating the URL;
Do not allow untrusted remote pages to navigate the application window.

The Electron main process must retrieve external .ics subscriptions. Do not fetch CCF subscriptions directly from the renderer. This avoids browser CORS limitations and keeps network behavior centralized.

Only allow automatic subscription requests to approved official hosts, initially:

https://ccfddl.com

A manually entered subscription URL should be validated before use. Clearly warn the user before allowing a non-official source.

4. Local-First Data and Privacy

All personal data must remain on the user’s computer.

Use SQLite as the primary persistent database. Store it inside Electron’s standard application data directory using:

app.getPath("userData")

Use explicit schema migrations.

If a native SQLite dependency causes packaging problems, use a well-supported Electron-compatible SQLite solution and document the tradeoff. Do not silently fall back to volatile memory.

Persist:

Calendar events;
Calendar sources;
Personal deadlines;
Conference deadline snapshots;
Followed conferences;
Conference change history;
Timeline milestones;
Habits;
Habit completions;
Application settings;
Dismissed warnings;
Subscription configuration;
Application metadata.

The application must also support:

Exporting all user data as a JSON backup;
Previewing and importing a JSON backup;
Exporting Calendar data as .ics;
Importing one or more .ics files;
Selecting a backup location through a native save dialog;
Restoring a backup through a native open dialog;
Clearing all local data after explicit confirmation;
Showing the local data directory in Settings;
Opening the data directory in the native file manager.

Never send personal data to GitHub or any external service.

Conference subscription requests may retrieve public conference data, but must never include personal deadlines, notes, habits, calendar events, or identifiers.

5. No AI

Do not implement:

An AI assistant;
A chatbot;
LLM integration;
Natural-language scheduling;
AI-generated plans;
AI insights;
AI deadline prediction;
AI progress evaluation;
AI-generated recommendations.

Do not include fake or disabled AI buttons.

All status calculations and warnings must use transparent deterministic rules.

6. No Seeded or Mock Personal Data

Do not pre-create fictional:

Calendar events;
Courses;
Research meetings;
Deadlines;
Papers;
Milestones;
Projects;
Habits;
Statistics;
Progress values.

A fresh installation must contain no personal data and must not follow any conference by default.

It is acceptable to use test fixtures inside the test suite. Test fixtures must never be inserted into the user’s production database.

Form placeholders may contain examples, but examples must not be saved automatically.

Every number, chart, countdown, progress bar, and summary shown in the real application must come from real user data or a successfully retrieved CCF subscription.

Design useful empty states instead of filling the application with sample content.

7. Visual Direction

The application should feel:

Colorful but focused;
Calm;
Modern;
Premium;
Academic;
Visual-first;
Personal rather than corporate;
Dense enough to be useful;
Easy to understand at a glance.

The interface may take atmospheric inspiration from:

Linear;
Notion Calendar;
Cron;
Things;
Apple Calendar;
Apple Health;
CCF Deadlines’ information density.

Do not directly copy any product.

Use a restrained neutral foundation with confident category accents. Color should encode categories, priorities, deadlines, and states without making the application childish or noisy.

Avoid:

Large decorative gradients;
Excessive glassmorphism;
Neon-heavy styling;
Oversized cards that waste space;
Excessive rounded containers;
Constant animation;
Enterprise-dashboard aesthetics;
Visual clutter.

Use:

Clear typography;
Strong time hierarchy;
Compact cards;
Thin timeline tracks;
Highly legible progress bars;
Subtle elevation;
Purposeful micro-interactions;
Consistent category colors;
Labels and icons in addition to color.

Support complete Light, Dark, and System themes.

Suggested status colors:

Ahead: green;
On Track: blue;
Behind: orange;
At Risk: red;
Urgent: bright red or coral;
Completed: muted green;
Overdue: deep red;
TBD: neutral gray or violet.

Do not rely on color alone. Every status must also have readable text and, where appropriate, an icon.

8. Application Shell

Create a desktop-oriented application shell containing:

Collapsible sidebar;
Main content area;
Native-feeling title bar where appropriate;
Page title;
Global current date and time;
Quick-create button;
Command palette;
Global search where useful;
Light/Dark/System theme control;
Responsive layout for smaller application windows.

Suggested keyboard shortcuts:

Cmd/Ctrl + K: command palette;
Cmd/Ctrl + N: context-aware create action;
Cmd/Ctrl + I: import .ics;
Cmd/Ctrl + ,: Settings;
Cmd/Ctrl + 1–5: switch pages;
T: go to today when Calendar is focused;
Esc: close the active modal or drawer.

Do not override standard operating-system shortcuts.

Remember:

Last selected page;
Window size;
Window position;
Calendar view;
Sidebar collapsed state;
Theme.
9. Calendar Page

Calendar is the default and most important page.

9.1 Layout

On desktop, use:

Main Calendar area on the left;
Today and Upcoming panel on the right.

At the top, show:

Current date;
Current weekday;
Live local time;
Active timezone;
Time until the next event;
Add Event;
Import .ics;
Calendar view switcher;
Today navigation;
Previous and next navigation.

If there is no next event, show a compact empty state.

9.2 Calendar Views

Support:

Month;
Week;
Day;
Agenda/List.

Use Week as the initial default unless a better persisted user preference exists.

Support:

Clicking an empty time slot to create an event;
Clicking an event to view its details;
Editing an event;
Deleting an event;
Dragging an event to another date or time;
Resizing an event;
All-day events;
Recurring events;
Category filtering;
Calendar source filtering;
Current-time indicator;
Today navigation;
Keyboard navigation where practical.
9.3 Calendar Event Model

Use a model equivalent to:

type CalendarEvent = {
  id: string;
  title: string;
  description?: string;

  startAt: string;
  endAt: string;
  timezone: string;
  allDay: boolean;

  category:
    | "course"
    | "research"
    | "meeting"
    | "deadline"
    | "work"
    | "health"
    | "personal"
    | "rest"
    | "other";

  recurrenceRule?: string;
  recurrenceId?: string;
  location?: string;

  sourceCalendarId?: string;
  importedUid?: string;

  linkedPersonalDeadlineId?: string;
  linkedConferenceDeadlineId?: string;
  linkedMilestoneId?: string;

  sourceManaged: boolean;
  createdAt: string;
  updatedAt: string;
};

Conference deadline events added from the subscription system must be marked sourceManaged: true.

9.4 Right Information Panel

Show:

Today
Today’s events;
The currently active event;
The next event;
Time remaining until the next event.
Nearest Deadline

Consider:

Active personal deadlines;
Followed conference deadlines only.

Do not show unfollowed conferences in this panel.

Display:

Deadline title;
Deadline type;
Exact countdown;
Local deadline time;
Status;
Personal work progress where applicable.
Today’s Habits

Show:

Habits scheduled for today;
Completion toggles;
Current streak.

Use a compact empty state when any section has no data.

10. Calendar .ics Import

.ics import must be fully functional, not a placeholder.

Support:

Native file selection;
Dragging files into the application;
Importing one or multiple .ics files.

Import workflow:

Select one or more files.
Parse them safely.
Display an import preview.
Show the number of recognized events.
Show the detected date range.
Show representative event previews.
Detect duplicates and conflicts.
Let the user choose a conflict policy.
Import only after explicit confirmation.
Display the imported events immediately.

Handle, as far as reasonably possible:

VEVENT;
UID;
DTSTART;
DTEND;
SUMMARY;
DESCRIPTION;
LOCATION;
RRULE;
EXDATE;
RDATE;
RECURRENCE-ID;
TZID;
UTC dates;
Floating local dates;
All-day events;
Recurring events;
Modified recurrence instances;
Cancelled events.

Do not shift all-day events to the previous or next date because of timezone conversion.

10.1 Duplicate Detection

Use, in order of reliability:

UID;
Recurrence ID;
Start instant;
Calendar source.

When duplicates or conflicts are found, offer:

Skip duplicates;
Replace existing;
Keep both.

Do not silently overwrite data.

10.2 Calendar Sources

Use a model equivalent to:

type CalendarSource = {
  id: string;
  name: string;
  color: string;
  type: "imported" | "local" | "conference";
  originalFileName?: string;
  importedAt: string;
  visible: boolean;
};

Allow the user to:

Rename a source;
Change its color;
Show or hide it;
Delete it;
Choose whether deleting a source also deletes its events.
10.3 Calendar Export

Support:

Exporting the entire Calendar;
Exporting one Calendar source;
Exporting a selected date range;
Exporting selected events.

Use a native save dialog.

Preserve, when possible:

UID;
Title;
Description;
Location;
Start and end;
Timezone;
All-day state;
Recurrence rule.
11. Deadlines Page

The Deadlines page must contain two clear tabs:

Conference Deadlines | Personal Deadlines

The two tabs should share a coherent visual language but use the correct data and controls for each deadline type.

12. Conference Deadlines

Conference deadlines come from CCF Deadlines .ics subscriptions.

Do not use AI to find deadlines. Do not scrape search engines. Do not invent or extrapolate future conference dates.

12.1 Official Subscriptions

Support at least:

English:
https://ccfddl.com/conference/deadlines_en.ics

Simplified Chinese:
https://ccfddl.com/conference/deadlines_zh.ics

Also support filtered subscription filenames based on:

Language;
CCF rank;
CORE rank;
TH-CPL rank;
Research subject.

Use the official filename convention described below.

No filters:

deadlines_en.ics
deadlines_zh.ics

Filter components may include:

ccf_{rank}
core_{rank}
thcpl_{rank}
{subject}

Use a stable filter order:

CCF rank
CORE rank
TH-CPL rank
Subject

Example:

Language: en
CORE: A
TH-CPL: B
Subject: SE

deadlines_en_core_A_thcpl_B_SE.ics

Encode A* as Astar.

Example:

deadlines_en_core_Astar_SE.ics

The application must provide:

A visual subscription builder;
Language selection;
Rank filters;
Subject filter;
Generated URL preview;
Custom subscription URL input;
Add subscription;
Remove subscription;
Enable or disable subscription;
Refresh now.

Use upstream subject categories rather than inventing an incompatible classification system. Examples include:

AI
CG
CT
DB
DS
HI
MX
NW
SC
SE

If the actual upstream format differs from an assumption, inspect the retrieved .ics data and preserve the upstream representation. Do not fabricate missing metadata.

12.2 Subscription Refresh

The Electron main process must perform subscription retrieval.

Implement:

Refresh when the application launches if the cache is stale;
Manual Refresh Now;
Configurable automatic refresh interval;
Default stale interval of approximately six hours;
Request timeout;
Safe retry behavior;
ETag support where available;
Last-Modified support where available;
Content hashing;
Last successful refresh timestamp;
Last refresh attempt timestamp;
Visible refresh status;
Error details that are useful but not alarming.

If a refresh fails:

Keep the last successfully cached snapshot;
Do not delete existing conference records;
Clearly indicate that cached data is being shown;
Display the timestamp of the cached snapshot;
Allow retry.

Do not use an untrusted public CORS proxy.

12.3 Canonical Conference Records

A conference record imported from the subscription is source-managed.

Store data equivalent to:

type ConferenceDeadline = {
  id: string;
  subscriptionId: string;

  upstreamUid?: string;
  title: string;
  conferenceName?: string;
  conferenceYear?: number;
  fullName?: string;

  category?: string;
  ccfRank?: string;
  coreRank?: string;
  thcplRank?: string;

  deadlineRound?: string;
  comment?: string;

  location?: string;
  conferenceStartAt?: string;
  conferenceEndAt?: string;

  deadlineAt?: string;
  originalTimezone?: string;
  rawDtStart?: string;

  homepageUrl?: string;
  sourceUrl: string;

  status: "upcoming" | "passed" | "tbd";
  rawIcsData?: string;

  upstreamSnapshotHash: string;
  upstreamUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

Use a stable identifier based on upstream UID when available. If no UID exists, derive a stable identifier from normalized source fields without using array position.

Do not allow users to directly edit source-managed deadline dates or canonical metadata.

12.4 Conference Card

Each conference card should display available upstream information such as:

Conference title;
Conference year;
Full conference name;
Research category;
CCF rank;
CORE rank;
TH-CPL rank;
Deadline round or comment;
Conference location;
Conference dates;
Original deadline time;
Original timezone;
Converted local deadline time;
Exact countdown;
Official homepage;
Follow or Unfollow;
Add to Calendar.

Do not display a fabricated field when the source does not provide it.

The card’s most prominent element should be the countdown.

Examples:

32 days
08 hours
14 minutes

When less than 24 hours remain, visually emphasize hours and minutes.

When passed, display:

Passed 2 days ago

When the upstream value is TBD:

Display TBD;
Do not create a fake countdown;
Do not infer a date;
Do not automatically add it to Calendar;
Do not move it to the next year.

Conference cards do not need a manually entered work-completion bar.

For a followed conference, a simple time-tracking bar may use followedAt as the start and the canonical deadline as the end. Label it clearly as time elapsed or time remaining. Do not present it as work completed.

Before a conference is followed, show the exact countdown without inventing an arbitrary start date for a percentage progress bar.

12.5 Conference Search, Filters, and Sorting

Support:

Search by conference name;
Filter by category;
Filter by CCF rank;
Filter by CORE rank;
Filter by TH-CPL rank;
Filter by year;
Filter by upcoming, passed, or TBD;
Hide passed conferences;
Sort by nearest deadline;
View multiple submission rounds for the same conference.
12.6 Following Conferences

The user must explicitly follow a conference.

Use a model equivalent to:

type FollowedConference = {
  conferenceDeadlineId: string;
  followedAt: string;

  intention?: "watching" | "considering" | "submitting";
  progress?: number;
  notes?: string;

  calendarEventId?: string;
};

On a fresh installation:

Follow no conferences;
Do not assume which conferences matter to the user;
Do not show arbitrary conferences in Calendar’s nearest-deadline panel;
Do not show arbitrary conferences in the personal Timeline.

Only followed conferences may appear in:

Calendar’s deadline overview;
Personal countdown summaries;
Timeline markers;
Followed-only filters.

User-owned values such as intention, notes, and optional submission progress must not modify the canonical upstream record.

12.7 Add Conference Deadline to Calendar

A real conference deadline may be added to Calendar.

The resulting event must:

Preserve the conference title;
Be marked as a deadline;
Store the conference deadline ID;
Use the exact deadline instant;
Preserve the original timezone information;
Link back to conference details;
Link to the official homepage when available;
Identify CCF Deadlines as its source;
Be marked as source-managed.

The user must not directly edit the source-managed deadline instant.

If the user wants to schedule writing or preparation time, they must create a separate editable personal Calendar event.

Avoid duplicate Calendar events when the same conference deadline is added more than once.

12.8 Detecting Upstream Changes

Compare each successfully retrieved snapshot with the previous stored snapshot.

Detect changes including:

Deadline changed;
Timezone changed;
Abstract deadline changed;
Round added;
Round removed;
Status changed to TBD;
Conference URL changed;
Conference dates changed.

Store change records equivalent to:

type ConferenceDeadlineChange = {
  id: string;
  conferenceDeadlineId: string;
  field: string;

  previousValue: unknown;
  currentValue: unknown;

  detectedAt: string;
  upstreamSnapshotHash: string;
  acknowledged: boolean;
};

Prioritize visible notifications for followed conferences.

Example:

SIGGRAPH 2027 was updated by CCF Deadlines.

Previous: Jan 21, 2027 · 22:00 PT
Current:  Jan 28, 2027 · 22:00 PT

When a canonical conference deadline changes:

Update the Conference Deadline page immediately;
Update its linked source-managed Calendar event;
Show Updated from CCF Deadlines;
Preserve the previous and current values in the change record;
Do not modify user-created preparation events;
Do not silently discard the old value;
Allow the user to acknowledge the notification.
13. Personal Deadlines

Personal deadlines are created manually by the user.

Use a model equivalent to:

type PersonalDeadline = {
  id: string;
  title: string;
  description?: string;

  trackingStartAt: string;
  deadlineAt: string;
  timezone: string;

  category:
    | "paper"
    | "course"
    | "scholarship"
    | "internship"
    | "academic"
    | "administrative"
    | "personal"
    | "other";

  priority: "low" | "medium" | "high" | "critical";

  status:
    | "not_started"
    | "in_progress"
    | "completed"
    | "missed";

  progress: number;

  sourceUrl?: string;
  location?: string;
  tags?: string[];

  linkedMilestoneId?: string;
  linkedCalendarEventId?: string;

  createdAt: string;
  updatedAt: string;
};

trackingStartAt defines when the user began tracking or preparing for the deadline.

Calculate:

timeProgress =
  (currentInstant - trackingStartInstant) /
  (deadlineInstant - trackingStartInstant);

Clamp the displayed percentage appropriately while preserving overdue status separately.

progress is manually entered work completion from 0 to 100.

13.1 Personal Deadline Form

Include:

Title;
Tracking start date and time;
Deadline date;
Exact deadline time;
Timezone;
Category;
Priority;
Current progress;
Description;
Optional source URL;
Optional location;
Optional tags.

Use the application timezone by default while allowing per-deadline timezone selection.

Support:

Local timezone;
IANA timezones;
UTC offsets;
AoE;
America/Los_Angeles / PT.

Interpret:

AoE as UTC−12;
PT as America/Los_Angeles, not a permanently fixed UTC−8 offset.
13.2 Personal Deadline Card

Display:

Title;
Category;
Priority;
Full deadline date;
Original timezone;
Converted local time;
Exact remaining time;
Work progress;
Time progress;
Pace difference;
Current status;
Tags;
Optional source link.

Use two clearly distinguishable progress bars:

Time elapsed;
Work completed.

Do not combine them into an unclear single metric.

Calculate:

paceDifference = workProgress - timeProgress;

Use centralized deterministic rules:

if (status === "completed") {
  result = "Completed";
} else if (now > deadlineAt) {
  result = "Overdue";
} else if (timeRemaining < 24 hours && progress < 90) {
  result = "Urgent";
} else if (progress < timeProgress - 20) {
  result = "At Risk";
} else if (progress < timeProgress - 8) {
  result = "Behind";
} else if (progress > timeProgress + 10) {
  result = "Ahead";
} else {
  result = "On Track";
}

Keep thresholds in a centralized configuration module.

13.3 Personal Deadline Views

Support:

Visual Cards;
Compact List;
Timeline View.

Use Visual Cards by default.

Support filters for:

Category;
Priority;
Status;
Tag;
Upcoming;
Completed;
Overdue.

Support sorting by:

Nearest first;
Farthest first;
Highest priority;
Lowest work progress;
Most at risk;
Recently created.
13.4 Personal Deadline Details

Open a drawer, modal, or dedicated detail panel.

Show:

Large countdown;
Time-progress bar;
Work-progress bar;
Pace difference;
Tracking start;
Exact deadline;
Original timezone;
Local converted time;
Description;
Source link;
Tags;
Linked milestone;
Linked Calendar event.

Allow progress updates through a slider and numerical input.

13.5 Calendar Linking

A personal deadline may be added to Calendar:

As an all-day event;
Or with its exact deadline time.

Support navigation:

From Deadline to the relevant Calendar date;
From Calendar event back to Deadline.

If the deadline changes, update its linked Calendar event without creating duplicates.

14. Deadline Summary

At the top of the Deadlines page, show a compact summary derived from real data:

Active deadlines;
Due this week;
At risk;
Completed;
Nearest deadline;
Followed conference deadlines.

Do not fill the screen with zero-valued summary cards on a fresh installation. Show a useful empty state instead.

Keep personal and conference statistics distinguishable.

15. Timeline Page

Timeline represents long-term PhD development rather than complex project management.

All milestones are manually created.

Use a model equivalent to:

type Milestone = {
  id: string;
  title: string;
  description?: string;

  startAt: string;
  targetAt: string;

  category:
    | "coursework"
    | "research"
    | "publication"
    | "phd_progress"
    | "internship"
    | "career"
    | "personal"
    | "other";

  status:
    | "not_started"
    | "in_progress"
    | "completed"
    | "delayed";

  progress: number;
  color?: string;

  createdAt: string;
  updatedAt: string;
};
15.1 Timeline Views

Support:

Semester View;
One-Year View;
Multi-Year View;
Chronological List.

Timeline visualization must include:

Current-date vertical marker;
Milestone time bars;
Work-progress fill inside each bar;
Start and target dates;
Milestone status;
Linked deadline markers;
Consistent category tracks;
Zoom or range controls where useful.

Multi-Year View should prioritize major stages rather than daily detail.

Semester View should show months and weeks more precisely.

15.2 Milestone Bar

Each milestone bar should communicate:

Total bar length: start to target;
Internal fill: actual completion percentage;
Current-date position;
Linked deadline markers;
Delayed state when the target has passed without completion.

The intended visual message is:

Time has progressed to this point, while the work has progressed to this point.

15.3 Timeline Checks

Use local deterministic rules to detect:

Milestone passed but incomplete;
Linked deadline occurs after the milestone target date;
Multiple high-priority deadlines in the same week;
Too many overlapping milestones;
Time progress substantially exceeds milestone work progress;
Milestone start occurs after its target;
Significant milestone overlap.

Each warning must explain:

What the problem is;
Which milestones or deadlines caused it;
Which rule was triggered;
A navigation action to the relevant content;
A Dismiss action.

Do not generate vague advice unsupported by stored data.

16. Habits Page

Keep Habits intentionally simple.

Do not implement:

Calorie tracking;
Protein tracking;
Diet logging;
Sleep tracking;
Weight tracking;
Body-fat tracking;
Medical data;
Health scores;
Gamified currency or levels.

Use models equivalent to:

type Habit = {
  id: string;
  name: string;
  color: string;
  icon?: string;

  frequency:
    | { type: "daily" }
    | { type: "weekly"; targetCount: number }
    | { type: "specific_days"; days: number[] };

  createdAt: string;
  archivedAt?: string;
};

type HabitCompletion = {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
};

Support:

Create habit;
Edit habit;
Archive habit;
Delete habit;
Mark complete;
Undo completion;
Daily frequency;
Weekly target;
Specific weekdays.

Display:

Today’s habits;
Current streak;
Longest streak;
Weekly completion rate;
Recent completion grid;
Calendar-style heatmap;
Compact progress rings;
Weekly progress bars.

Habit names must be created by the user.

Placeholders may contain examples such as Exercise, Reading, or Deep Work, but do not create them automatically.

17. Settings Page

Keep Settings concise and useful.

General
Application timezone;
Date format;
Monday or Sunday as the first day of the week;
12-hour or 24-hour clock;
Light, Dark, or System theme;
Default Calendar view;
Launch behavior.
Conference Subscriptions
View active subscriptions;
Add a filtered CCF subscription;
Add a custom subscription URL;
Enable or disable a subscription;
Remove a subscription;
Refresh now;
Automatic refresh interval;
Last successful refresh;
Last failed refresh;
Cache status.
Data
Export full JSON backup;
Preview and import JSON backup;
Export Calendar as .ics;
View local database location;
Open the application data directory;
Clear all local data.

All imports must show a preview before modifying the database.

Clearing all local data must:

Display an explicit warning;
Require a second confirmation;
Explain that the operation cannot be undone;
Recommend exporting a backup first;
Avoid deleting unrelated files outside the application data directory.
About

Show:

Application version;
Data storage explanation;
Offline behavior;
CCF Deadlines attribution;
Relevant open-source licenses.
18. Timezone and Countdown Correctness

Time handling must be treated as a correctness-critical feature.

Requirements:

Detect the system timezone by default;
Allow the user to override the display timezone;
Preserve the original event or deadline timezone;
Store canonical instants separately from display formatting;
Parse .ics UTC and TZID values correctly;
Preserve floating-time semantics where required;
Prevent all-day events from moving across calendar dates;
Interpret AoE as UTC−12;
Interpret PT as America/Los_Angeles;
Handle daylight-saving transitions correctly;
Recalculate countdowns whenever the application opens;
Never persist a countdown result as canonical data;
Refresh countdowns at least once per minute;
Refresh every second when less than 24 hours remain;
Display both source time and local time where available.

Each deadline should display:

Original deadline time;
Original timezone name;
User-local time;
Precise countdown.

Example:

Paper Deadline
Sep 18, 2026 · 23:59 AoE
Local: Sep 19, 2026 · 04:59 PDT
12 days 08 hours remaining

If a source provides only an absolute UTC instant and no original timezone, do not invent one. Display the known source representation and explicitly state when the original timezone is unavailable.

For TBD deadlines:

Display TBD;
Do not display a countdown;
Do not create a Calendar event;
Do not infer a date.

For passed deadlines:

Display Passed or the overdue duration;
Keep them available under Past;
Never automatically reinterpret them as next year’s event.
19. Empty States

Because personal mock data is forbidden, empty states are essential.

Calendar
Your calendar is empty.

Actions:

Import .ics;
Create Event.
Conference Deadlines

If no subscription has been added:

No conference subscription yet.

Actions:

Add CCF Subscription;
Enter Subscription URL.

If a subscription exists but has not loaded:

Show loading or error state;
Do not create placeholder conferences.
Personal Deadlines
No personal deadlines yet.

Action:

Add Personal Deadline.

Explain briefly that countdowns and progress tracking will appear after a deadline is added.

Timeline
Your timeline starts here.

Action:

Add Milestone.
Habits
No habits yet.

Action:

Create Habit.
20. Data Consistency

All pages must use the same canonical local data.

Examples:

Editing a Calendar event updates Today immediately;
Editing a personal deadline updates its countdown and Calendar link;
Updating deadline progress updates all related visualizations;
Following a conference updates Calendar’s deadline panel;
Unfollowing a conference removes it from followed-only summaries but does not delete the canonical cached record;
Adding a conference deadline to Calendar creates only one source-managed event;
An upstream conference update changes the linked source-managed event;
An upstream update does not modify personal preparation events;
Completing a habit updates Habits and Calendar’s Today panel;
Editing a milestone updates all Timeline views;
Deleting linked data handles relationships explicitly.

Do not maintain divergent copies of the same object in multiple UI components.

21. Recommended Project Structure

Use a structure similar to:

src/
  main/
    index.ts
    windows/
    ipc/
    database/
    subscriptions/
    filesystem/
    security/

  preload/
    index.ts
    api.ts
    types.ts

  renderer/
    app/
      router.tsx
      layout/
    pages/
      CalendarPage.tsx
      DeadlinesPage.tsx
      TimelinePage.tsx
      HabitsPage.tsx
      SettingsPage.tsx
    components/
      ui/
      calendar/
      deadlines/
      conferences/
      timeline/
      habits/
      common/
    features/
      calendar/
      personal-deadlines/
      conference-deadlines/
      timeline/
      habits/
      settings/
    lib/
      dates/
      ics/
      deadline-status/
      backup/
      visualization/
    hooks/
    styles/
    types/

  shared/
    ipc/
    schemas/
    types/
    constants/

tests/
  unit/
  integration/
  e2e/
  fixtures/

Keep business calculations independent from UI components.

Create and test functions such as:

calculateRemainingTime()
calculateTimeProgress()
calculatePaceDifference()
calculateDeadlineStatus()
parseConferenceSubscription()
buildCcfSubscriptionUrl()
compareConferenceSnapshots()
calculateHabitStreak()
detectCalendarConflicts()
detectTimelineWarnings()
convertDeadlineTimezone()
22. Error Handling

Design explicit states for:

No network;
Subscription timeout;
Invalid subscription URL;
Invalid .ics;
Partially valid .ics;
Duplicate events;
Database migration failure;
Backup import failure;
Unsupported backup version;
File permission error;
Export cancellation;
Corrupted cached subscription.

Errors should:

Explain what failed;
Preserve existing local data;
Avoid destructive recovery;
Offer a retry or safe next action;
Be logged locally for debugging without storing sensitive content unnecessarily.

Do not use silent catch blocks.

23. Accessibility and Usability

Implement:

Keyboard-accessible controls;
Visible focus states;
Proper button and form labels;
Semantic headings;
Accessible modal focus management;
Sufficient color contrast;
Text labels for color-coded states;
Tooltips only as secondary explanation;
Reduced-motion support;
Screen-reader labels for icon-only buttons;
Error messages connected to invalid fields.

Optimize primarily for desktop use at approximately 1280–1600 px width, while allowing the window to shrink without breaking the core interface.

24. Development Phases
Phase 1: Desktop Foundation
Electron setup;
Main, preload, and renderer separation;
Secure IPC;
React and TypeScript;
Tailwind and UI primitives;
Routing;
Sidebar;
Theme;
SQLite persistence;
Database migrations;
Empty states;
Native file dialogs.
Phase 2: Calendar
Calendar views;
Event CRUD;
Drag and resize;
Recurrence;
.ics import;
Import preview;
Duplicate detection;
Calendar sources;
.ics export;
Today panel.
Phase 3: Conference Deadlines
CCF subscription builder;
Main-process fetching;
ICS parsing;
Local cache;
Refresh controls;
Conference cards;
Search and filters;
Follow state;
Add to Calendar;
Upstream change detection;
Cached offline behavior.
Phase 4: Personal Deadlines
CRUD;
Exact countdowns;
Time progress;
Work progress;
Pace status;
Cards, list, and timeline views;
Filters and sorting;
Calendar linking.
Phase 5: Timeline
Milestone CRUD;
Semester view;
One-year view;
Multi-year view;
Now marker;
Milestone bars;
Deadline markers;
Deterministic timeline warnings.
Phase 6: Habits
Habit CRUD;
Completion tracking;
Streak calculation;
Weekly progress;
Heatmap;
Calendar page integration.
Phase 7: Desktop Delivery
JSON backup and restore;
Data-clearing flow;
Keyboard shortcuts;
Accessibility pass;
Unit tests;
Integration tests;
Electron end-to-end tests;
Type checking;
Linting;
Production packaging;
README;
Installation instructions.
25. Required Tests

At minimum, test the following.

Time and Deadlines
Future deadline;
Deadline less than 24 hours away;
Overdue deadline;
Completed personal deadline;
AoE deadline;
PT daylight-saving behavior;
Time-progress calculation;
Pace difference;
Risk thresholds;
Tracking start equal to deadline;
Missing optional fields;
TBD conference deadline;
Passed conference deadline;
Original and local timezone display.
Conference Subscriptions
Default English URL;
Default Chinese URL;
One filter;
Multiple filters;
Stable filter order;
A* to Astar;
Successful subscription;
Invalid .ics;
Network failure with cached fallback;
ETag or unchanged-content handling;
Stable conference IDs;
Snapshot change detection;
Added round;
Removed round;
Deadline changed;
TBD transition;
Calendar event synchronization;
Personal preparation event remains unchanged.
Calendar
Basic .ics event;
All-day event;
UTC event;
TZID event;
Recurring event;
Modified recurrence;
Cancelled event;
Duplicate UID;
Import conflict;
Export and re-import;
Source deletion;
Source-managed deadline event.
Habits
Daily streak;
Broken streak;
Weekly target;
Specific weekday habit;
Timezone boundary;
Archive behavior.
Timeline
Overdue milestone;
Conflicting milestones;
Deadline beyond milestone;
Multiple high-priority deadlines in one week;
Time progress exceeding work progress.
Persistence and Backup
Data survives application restart;
Database migration;
JSON export;
Valid JSON restore;
Invalid backup rejection;
Backup preview;
Clear-data confirmation;
Application data path isolation.
26. Acceptance Criteria

The final application must satisfy all of the following:

It is a standalone Electron desktop application.
It launches in its own application window.
The packaged application does not require a browser or localhost.
Calendar is the default page.
A fresh installation contains no fictional personal data.
No conference is followed by default.
Every page has a thoughtfully designed empty state.
Calendar events can be created, edited, moved, resized, and deleted.
Real .ics files can be imported.
Import includes preview and confirmation.
Duplicate imports are detected.
Calendar events can be exported as .ics.
CCF subscriptions are retrieved by the Electron main process.
The subscription builder supports language and official filters.
Conference data remains available offline after a successful refresh.
Refresh failure does not delete cached data.
Conference deadlines display precise countdowns.
Original and local deadline times are displayed when available.
TBD deadlines do not receive fake dates or countdowns.
Passed deadlines do not jump to the following year.
Conference canonical dates cannot be manually edited.
The user can explicitly follow or unfollow conferences.
Only followed conferences appear in personal overview areas.
Conference deadlines can be added to Calendar.
Source-managed Calendar events synchronize with upstream changes.
User-created preparation events are never silently modified.
Upstream changes preserve previous and current values.
Personal deadlines are manually editable.
Personal deadlines display time progress and work progress separately.
Personal deadline status comes from centralized deterministic rules.
Deadlines can be searched, filtered, and sorted.
Timeline includes a current-date marker.
Milestones use time bars with progress fill.
Timeline warnings are based only on real stored data.
Habits support creation, completion, undo, and streaks.
No calorie, sleep, weight, or protein tracking exists.
All personal data is stored locally.
Data survives application restart.
JSON backup export and restore work.
Clear All Data requires explicit double confirmation.
The app contains no AI features.
The app has no cloud database or authentication.
Light, Dark, and System themes are readable.
The interface is colorful but focused.
Electron security settings follow best practices.
TypeScript strict mode passes.
Linting passes.
Unit tests pass.
Critical Electron end-to-end tests pass.
A production installer can be generated successfully.
The packaged app has no obvious console or runtime errors.
27. README Requirements

Create a practical README explaining:

What My PhD OS is;
Supported platforms;
Technology stack;
Development prerequisites;
How to install dependencies;
How to run development mode;
How to run tests;
How to build the production application;
How to generate installers;
Where local data is stored;
How conference subscriptions work;
How .ics import and export work;
How JSON backup and restore work;
How offline caching works;
Current limitations;
Privacy behavior;
Why clearing application data can cause permanent loss;
Why regular backups are recommended.

Do not include private .ics files, JSON backups, databases, or user data in the repository.

Add appropriate ignore rules for:

Local databases;
Exported backups;
Imported calendars;
Build artifacts;
Installer output;
Logs;
Platform-specific temporary files.
28. Final Delivery Report

After implementation, report:

Which pages were implemented;
Which desktop interactions work;
How Electron main, preload, and renderer are separated;
Where local data is stored;
How .ics import and export work;
How CCF subscriptions are generated and refreshed;
How offline conference caching works;
How upstream changes are detected;
How personal deadline status is calculated;
Which Timeline warning rules were implemented;
How to run the application in development;
How to build and install the standalone application;
Results of tests, linting, type checking, and packaging;
Known limitations.

Prioritize a coherent, polished, genuinely usable application over superficial feature quantity.

The most important outcomes are:

A real standalone desktop application;
A genuinely useful Calendar;
Accurate conference subscription tracking;
Precise timezone-aware countdowns;
Clear personal deadline visualization;
A compact long-term PhD Timeline;
Simple habit tracking;
No fictional personal data;
Reliable local persistence;
A colorful but focused visual design.