# Habits feature

Spec §16. Pure logic lives in `src/shared/habits/streaks.ts` (due-day rules, current/longest streak
for daily, weekly-target and specific-day habits, weekly completion, completion grid), unit-tested
including the timezone boundary.

- `api.ts`: list/completions queries and create/update/archive/delete/setCompletion mutations.
- `components/HabitCard.tsx`: streaks, this-week progress, 10-week heatmap, today toggle, menu
  (edit / archive / delete with confirmation).
- `components/HabitForm.tsx`: name, colour, optional icon (`icons.ts`, rendered via `DynamicIcon`),
  frequency.
- `components/TodayHabitsCompact.tsx`: today's due habits (Calendar right panel + Habits page).
- `pages/HabitsPage.tsx`: today section, active and archived grids, quick-create, `{ create }` deep link.
