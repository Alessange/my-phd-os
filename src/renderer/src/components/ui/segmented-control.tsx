import { useRef, type ReactNode } from 'react'
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

/**
 * Radio-group semantics with arrow-key movement for small enumerations (theme, clock, week start,
 * view switches). Looks exactly like `Tabs`: ink-3 text, the active one in ink with a 1.5 px underline.
 */
export function SegmentedControl<V extends string>({
  value,
  onValueChange,
  options,
  size = 'md',
  className,
  disabled,
  ...props
}: SegmentedControlProps<V>): React.JSX.Element {
  const group = useRef<HTMLDivElement>(null)
  // Arrow keys move focus together with the selection (WAI-ARIA radio group): the focused radio is
  // always the checked one and the only tab stop, so a screen reader never says "not checked".
  const move = (delta: number): void => {
    const index = options.findIndex((option) => option.value === value)
    const nextIndex = (index + delta + options.length) % options.length
    const next = options[nextIndex]
    if (!next) return
    onValueChange(next.value)
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
  }
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={props['aria-label']}
      className={cn(
        'inline-flex w-fit max-w-full flex-wrap items-center gap-x-5 text-ink-3',
        size === 'sm' ? 'min-h-8' : 'min-h-9',
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
              'relative inline-flex items-center justify-center gap-1.5 text-sm whitespace-nowrap transition-colors duration-100',
              'hover:text-ink disabled:cursor-not-allowed',
              size === 'sm' ? 'h-8' : 'h-9',
              'after:absolute after:inset-x-0 after:bottom-0 after:h-[1.5px] after:bg-ink after:opacity-0',
              selected && 'text-ink after:opacity-100',
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
