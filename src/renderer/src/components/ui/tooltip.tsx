import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

export function TooltipProvider({
  delayDuration = 400,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>): React.JSX.Element {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>): React.JSX.Element {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'floating z-50 w-fit max-w-xs rounded-sm px-2.5 py-1.5 text-xs',
          'animate-in fade-in-0 duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
