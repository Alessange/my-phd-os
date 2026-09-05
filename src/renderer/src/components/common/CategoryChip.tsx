import { getCategory, type CategoryId } from '@shared/constants/categories'
import { chipStyle, cn } from '@renderer/lib/utils'
import { DynamicIcon } from './DynamicIcon'

export interface CategoryChipProps {
  category: CategoryId
  /** `dot` (default) shows a coloured dot + label; `icon` shows the category icon instead. */
  marker?: 'dot' | 'icon'
  /** Tinted background like a badge instead of plain text. */
  tinted?: boolean
  className?: string
}

export function CategoryChip({
  category,
  marker = 'dot',
  tinted = false,
  className
}: CategoryChipProps): React.JSX.Element {
  const definition = getCategory(category)
  return (
    <span
      data-category={definition.id}
      style={chipStyle(definition.colorToken)}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        tinted ? 'chip-tint rounded-sm px-1.5 py-px' : 'text-foreground',
        className
      )}
    >
      {marker === 'dot' ? (
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--chip)" />
      ) : (
        <DynamicIcon name={definition.icon} className="size-3.5 shrink-0 text-(--chip)" />
      )}
      {definition.label}
    </span>
  )
}
