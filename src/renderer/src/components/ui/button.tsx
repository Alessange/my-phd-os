import { Slot } from './slot'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'
import { buttonVariants, type ButtonVariantProps } from './button-variants'

export interface ButtonProps extends ComponentProps<'button'>, ButtonVariantProps {
  /** Render the child element instead of a `<button>` (e.g. for Radix triggers). */
  asChild?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps): React.JSX.Element {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
