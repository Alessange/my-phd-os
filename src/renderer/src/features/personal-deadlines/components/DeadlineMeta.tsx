import { PRIORITY_DEFINITIONS } from '@shared/constants/statuses'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { CategoryChip } from '@renderer/components/common/CategoryChip'

/** Only the priorities that ask for attention are printed; Low and Medium are the quiet default. */
const loudPriority = (deadline: Pick<PersonalDeadline, 'priority'>): boolean =>
  deadline.priority === 'high' || deadline.priority === 'critical'

/**
 * `Administrative · High priority`: the category as a word, then the priority only when it is High
 * or Critical (DESIGN.md migration table: no chips, plain words joined by a middle dot).
 */
export function DeadlineMeta({
  deadline,
  className
}: {
  deadline: Pick<PersonalDeadline, 'category' | 'priority'>
  className?: string
}): React.JSX.Element {
  return (
    <span className={className ?? 'text-meta text-ink-3'}>
      <CategoryChip category={deadline.category} />
      {loudPriority(deadline) && (
        <span> · {PRIORITY_DEFINITIONS[deadline.priority].label} priority</span>
      )}
    </span>
  )
}
