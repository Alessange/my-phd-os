import { Plus } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'
import { Label } from './label'

/**
 * The quiet property row every dialog shares (DESIGN.md section 6): 50 px high, ink label on the
 * left, the value control(s) on the right, one hairline under the row. Rows stack in a plain
 * column with no divider of their own, so the last row also closes the group.
 */
export const propertyRowClass =
  'flex min-h-[50px] items-center justify-between gap-4 border-b border-line text-body text-ink'

export interface PropertyRowProps extends Omit<ComponentProps<'div'>, 'children'> {
  label: string
  /** Id of the control the label names. Without it the label is plain text (a group of buttons). */
  htmlFor?: string
  children: ReactNode
}

export function PropertyRow({
  label,
  htmlFor,
  className,
  children,
  ...props
}: PropertyRowProps): React.JSX.Element {
  return (
    <div data-slot="property-row" className={cn(propertyRowClass, className)} {...props}>
      {htmlFor ? (
        <Label variant="inline" htmlFor={htmlFor} className="shrink-0">
          {label}
        </Label>
      ) : (
        <span className="shrink-0">{label}</span>
      )}
      <div className="flex min-w-0 items-center justify-end gap-1">{children}</div>
    </div>
  )
}

/** The "Add ..." row for an optional field: a property row with a trailing plus. */
export function AddRow({
  className,
  children,
  ...props
}: ComponentProps<'button'>): React.JSX.Element {
  return (
    <button
      type="button"
      data-slot="add-row"
      className={cn(propertyRowClass, 'w-full text-left text-ink-2 hover:text-ink', className)}
      {...props}
    >
      {children}
      <Plus className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
    </button>
  )
}
