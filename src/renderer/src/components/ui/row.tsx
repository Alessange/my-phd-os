import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'
import { Slot } from './slot'

/**
 * Hairline list (DESIGN.md section 6, "Row"): the replacement for a stack of cards. Children are
 * `Row`s; a 1 px `--line` rule sits between them and never after the last.
 *
 *   <RowList><Row>...</Row><Row selected>...</Row></RowList>
 */
export function RowList({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="row-list"
      className={cn('flex flex-col divide-y divide-line', className)}
      {...props}
    />
  )
}

export interface RowProps extends ComponentProps<'div'> {
  /** Selected rows get a 7% ink wash and a 2 px ink rule on the leading edge. */
  selected?: boolean
  /** Render the child (a `button`, an `a`) as the row so the whole row is a real control. */
  asChild?: boolean
  /** One line is 50 px, `two-line` 52 px, `lead` 100 px. Default `one-line`. */
  density?: 'one-line' | 'two-line' | 'lead'
}

/**
 * One quiet list item. No fill and no border of its own: the hairline comes from `RowList`.
 * Hover shows nothing that looks like a button; reveal secondary text with `group-hover/row` and
 * `group-focus-within/row` (the row is a `group/row`). Interactive rows must be real controls.
 */
export function Row({
  className,
  selected = false,
  asChild = false,
  density = 'one-line',
  ...props
}: RowProps): React.JSX.Element {
  const Comp = asChild ? Slot : 'div'
  return (
    <Comp
      data-slot="row"
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'group/row relative flex w-full items-center gap-4 text-left',
        density === 'one-line' && 'min-h-[50px] py-3',
        density === 'two-line' && 'min-h-[52px] py-2',
        density === 'lead' && 'min-h-[100px] py-4',
        // The wash (before) and the 2 px rule (after) hang 16 px into the gutter so the text keeps its
        // column and never touches the rule; `isolate` keeps the wash behind the text.
        selected &&
          'isolate before:pointer-events-none before:absolute before:inset-y-0 before:-inset-x-4 before:-z-10 before:bg-selected after:pointer-events-none after:absolute after:inset-y-0 after:-left-4 after:w-0.5 after:bg-ink',
        className
      )}
      {...props}
    />
  )
}
