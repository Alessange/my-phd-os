import type { ComponentProps } from 'react'
import { chipStyle, cn } from '@renderer/lib/utils'
import { badgeVariants, type BadgeVariantProps } from './badge-variants'

export interface BadgeProps extends ComponentProps<'span'>, BadgeVariantProps {
  /** Theme colour token (`status-ahead`, `category-paper`, `priority-high`) for the `status` variant. */
  colorToken?: string
}

export function Badge({
  className,
  variant,
  colorToken,
  style,
  ...props
}: BadgeProps): React.JSX.Element {
  const resolvedVariant = colorToken ? 'status' : variant
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant: resolvedVariant }), className)}
      style={colorToken ? { ...chipStyle(colorToken), ...style } : style}
      {...props}
    />
  )
}
