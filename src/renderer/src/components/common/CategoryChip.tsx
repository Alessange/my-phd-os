import { getCategory, type CategoryId } from '@shared/constants/categories'
import { cn } from '@renderer/lib/utils'

export interface CategoryChipProps {
  category: CategoryId
  className?: string
}

/** A category is a word in ink-2 (DESIGN.md section 2.2). No dot, glyph, hue, fill or pill. */
export function CategoryChip({ category, className }: CategoryChipProps): React.JSX.Element {
  const definition = getCategory(category)
  return (
    <span
      data-category={definition.id}
      className={cn('inline-flex items-center text-xs whitespace-nowrap text-ink-2', className)}
    >
      {definition.label}
    </span>
  )
}
