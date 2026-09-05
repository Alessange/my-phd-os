import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export interface SegmentedOption<V extends string> {
  value: V
  label: ReactNode
  /** Accessible name when `label` is an icon. */
  ariaLabel?: string
  icon?: ReactNode
}

export interface SegmentedControlProps<V extends string> {
  value: V
  onValueChange: (value: V) => void
  options: readonly SegmentedOption<V>[]
  /** Accessible name for the whole group. */
  'aria-label': string
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
}

/** Radio-group semantics with arrow-key movement; used for small enumerations (theme, clock, week start). */
export function SegmentedControl<V extends string>({
  value,
  onValueChange,
  options,
  size = 'md',
  className,
  disabled,
  ...props
}: SegmentedControlProps<V>): React.JSX.Element {
  const move = (delta: number): void => {
    const index = options.findIndex((option) => option.value === value)
    const next = options[(index + delta + options.length) % options.length]
    if (next) onValueChange(next.value)
  }
  return (
    <div
      role="radiogroup"
      aria-label={props['aria-label']}
      className={cn(
        'inline-flex w-fit items-center gap-0.5 rounded-md bg-muted p-0.5 text-muted-foreground',
        size === 'sm' ? 'h-7' : 'h-8',
        disabled && 'opacity-50',
        className
      )}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          move(1)
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          move(-1)
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'inline-flex h-full items-center justify-center gap-1.5 rounded-[6px] px-2.5 font-medium whitespace-nowrap transition-colors outline-none',
              size === 'sm' ? 'text-xs' : 'text-[13px]',
              'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-muted',
              selected && 'bg-card text-foreground shadow-xs',
              '[&_svg]:size-4 [&_svg]:shrink-0'
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
