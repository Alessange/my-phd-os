# Timeline feature

Spec §15. Pure logic lives in `src/shared/timeline` (`rules.ts`: the seven checks + thresholds +
`RULE_LABELS`; `detectTimelineWarnings.ts`: the aggregator); layout math for the Gantt lives in
`layout.ts` (window per view + range offset, clip-aware bar/fill/today-tick/marker positions, lane
packing, zone-aware axis ticks). Both are unit-tested.

- `api.ts`: `useMilestones/useMilestone/useCreateMilestone/useUpdateMilestone/useDeleteMilestone`
  and the dismissed-warning hooks (`useDismissedWarnings/useDismissWarning/useRestoreWarning`).
- `components/TimelineGantt.tsx`: category tracks, lanes, bars (span tint, work fill, today tick,
  linked-deadline markers, overdue border), a "Followed conferences" marker track (point markers
  packed into lanes; click opens the conference on the Deadlines page), global current-date line,
  legend.
- `components/TimelineList.tsx`: chronological table with pace sentence.
- `components/TimelineWarnings.tsx`: checks panel with Open / Dismiss / Restore.
- `components/MilestoneForm.tsx`: create / edit / delete (confirmed).
- `pages/TimelinePage.tsx`: view switch persisted in `ui.timelineView`, range controls, deep links
  `{ milestoneId }` and `{ create }`, quick-create registration.

Linked deadlines come from `personalDeadlines:list` (`linkedMilestoneId`); followed conferences
come from `conferences:listFollowed` (only followed ones ever reach the Timeline, spec §12.6).
