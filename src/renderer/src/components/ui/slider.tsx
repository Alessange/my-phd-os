import * as SliderPrimitive from '@radix-ui/react-slider'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

/** 2 px track line, ink fill, 16 px ink thumb inside a 28 px hit box. */
export function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>): React.JSX.Element {
  const values = value ?? defaultValue ?? [min]
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex h-7 w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-7 data-[orientation=vertical]:flex-col',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative grow overflow-hidden bg-track data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-0.5">
        <SliderPrimitive.Range className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          // The focusable role=slider element is the thumb, so it carries the name (one thumb gets none from Radix).
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          className="block size-4 shrink-0 rounded-full bg-primary transition-transform duration-100 hover:scale-110 disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
}
