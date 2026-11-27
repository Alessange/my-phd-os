# Habits feature

Spec §16. Pure logic lives in `src/shared/habits/streaks.ts` (due-day rules, current/longest streak
for daily, weekly-target and specific-day habits, weekly completion, completion grid), unit-tested
including the timezone boundary.

- `api.ts`: list/completions queries and create/update/archive/delete/setCompletion mutations.
- `habitDisplay.ts`: shared constants (history window, grid weeks), cadence and streak-unit wording,
  and this week's progress counted only up to today.
- `components/HabitCard.tsx`: one hairline row per habit: a single done control (`role="switch"`),
  cadence, the quiet 10-week grid (done / not done / not scheduled, today ringed), this week and the
  streak with its best. The row menu (Edit / Archive / Delete with confirmation) shows on hover and
  focus. Archived habits render as plain text rows. Bold is reserved for the one habit still to do next.
- `components/HabitForm.tsx`: name, frequency, then quiet property rows (times per week, weekdays,
  colour as a 6 px normalised dot with a swatch popover). The icon picker is gone; a stored icon and
  the stored colour are preserved on edit. Validation never shows on a pristine field; Enter submits.
- `components/TodayHabitsCompact.tsx`: today's due habits with a check and the streak (Calendar right
  panel).
- `pages/HabitsPage.tsx`: day tally, column heads, the list, the collapsed Archived list, quick-create
  and the `{ create }` deep link.
