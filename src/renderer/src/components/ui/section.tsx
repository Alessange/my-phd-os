import type { ComponentProps, ElementType, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export interface SectionHeadingProps extends ComponentProps<'h2'> {
  /** Heading element; default `h2`. */
  as?: ElementType
  /** Optional count printed after the label (`Overdue 1`). */
  count?: ReactNode
}

/** Section heading: 18 px ink-2, sentence case, no icon, no caps. Replaces every uppercase micro-label. */
export function SectionHeading({
  as: Comp = 'h2',
  className,
  children,
  count,
  ...props
}: SectionHeadingProps): React.JSX.Element {
  return (
    <Comp data-slot="section-heading" className={cn('text-lead text-ink-2', className)} {...props}>
      {children}
      {count !== undefined && <span className="tabular ml-2 text-ink-3">{count}</span>}
    </Comp>
  )
}

export interface SectionProps extends Omit<ComponentProps<'section'>, 'title'> {
  title?: ReactNode
  count?: ReactNode
  /** Right-aligned text links or a quiet control. */
  actions?: ReactNode
  /** Heading element; default `h2`. */
  headingAs?: ElementType
}

/**
 * A page section on the paper ground: heading row, then content, separated from its neighbours by
 * whitespace (24-32 px), never by a card or a border. Surface-free by design.
 *
 *   <Section title="Following" count={7} actions={<button className="link-quiet">Show passed (1)</button>}>...</Section>
 */
export function Section({
  title,
  count,
  actions,
  headingAs,
  className,
  children,
  ...props
}: SectionProps): React.JSX.Element {
  return (
    <section data-slot="section" className={cn('flex flex-col gap-4', className)} {...props}>
      {(title !== undefined || actions) && (
        <div className="flex items-baseline justify-between gap-4">
          {title !== undefined && (
            <SectionHeading as={headingAs} count={count}>
              {title}
            </SectionHeading>
          )}
          {actions && <div className="flex items-baseline gap-4 text-sm">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
