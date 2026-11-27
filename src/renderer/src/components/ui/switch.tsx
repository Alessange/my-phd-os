import * as SwitchPrimitive from '@radix-ui/react-switch'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

/**
 * 34 x 20 track: off = 1 px edge, on = ink fill. The thumb is ink-3 when off and paper when on. A
 * transparent ::after widens the hit box to 38 x 28 (DESIGN.md: hit boxes never below 28).
 */
export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>): React.JSX.Element {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer relative inline-flex h-5 w-[34px] shrink-0 items-center rounded-full border transition-colors duration-100 after:absolute after:-inset-x-0.5 after:-inset-y-1 after:content-[""]',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=unchecked]:border-edge data-[state=unchecked]:bg-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 rounded-full transition-transform duration-100 data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-ink-3"
      />
    </SwitchPrimitive.Root>
  )
}
