# Timeline feature

Spec §15. Pure logic lives in `src/shared/timeline` (`rules.ts`: the seven checks + thresholds +
`RULE_LABELS`; `detectTimelineWarnings.ts`: the aggregator); layout math for the Gantt lives in
`layout.ts` (window per view + range offset, clip-aware bar/fill/today-tick/marker positions, lane
packing, zone-aware axis ticks, where a bar's value is printed). Both are unit-tested.

- `api.ts`: `useMilestones/useMilestone/useCreateMilestone/useUpdateMilestone/useDeleteMilestone`
  and the dismissed-warning hooks (`useDismissedWarnings/useDismissWarning/useRestoreWarning`).
- `checks.ts`: presentation helpers for the checks (rule tags, the `4 open · 1 past target · 3 overlaps`
  summary, a deterministic order, dates re-printed in the user's format instead of the detectors'
  UTC slices, milestone names split out as links). It never decides whether a check fires.
- `components/TimelineGantt.tsx`: one row per milestone, grouped by category (small-caps label on the
  first row of a group). The outline of a bar is the plan, the ink fill is the work done, no text
  inside a bar; the value (`40%`, `Past target by N days`, `Completed`) is printed beside it
  (`barLabelSide`). One 1 px ink Today line behind the labels, `<` / `>` cues for clipped bars,
  linked-deadline diamonds on bars, a "Followed conferences" strip of diamonds (two labelled lanes,
  further diamonds are nameless in an extra row; click opens the conference on Deadlines), and a
  footer that counts milestones outside the range with a `Show multi-year` link. Rows tighten from
  68 to 54 px above six rows.
- `components/TimelineList.tsx`: calm chronological table (hairline rows, one ink rule under the
  head, page scroll), pace only when notable.
- `components/TimelineWarnings.tsx`: one `role=status` line + `Review` link; two or fewer open checks
  show their hairline rows straight away, more collapse. Rows: rule tag, problem, cause, Open /
  Dismiss text links, sr-only `Rule:` line; `Dismissed (N)` disclosure with Restore.
- `components/MilestoneForm.tsx`: create / edit / delete (confirmed). Title and dates up front,
  category / status / progress / description as quiet property rows. The colour picker is gone; the
  stored `color` is never sent, so an update never overwrites it. Title is only marked invalid after
  blur.
- `pages/TimelinePage.tsx`: view switch persisted in `ui.timelineView`, the range label and
  previous / next controls inside the chart (`Today` only when the range is shifted), deep links
  `{ milestoneId }` and `{ create }`, quick-create registration, the create button through
  `PageAction`.

Linked deadlines come from `personalDeadlines:list` (`linkedMilestoneId`); followed conferences
come from `conferences:listFollowed` (only followed ones ever reach the Timeline, spec §12.6).
