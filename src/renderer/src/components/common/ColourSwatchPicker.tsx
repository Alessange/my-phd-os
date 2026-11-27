import { COLOUR_SWATCHES } from '@renderer/lib/colourSwatches'
import { cn, userColor } from '@renderer/lib/utils'

export interface ColourSwatchPickerProps {
  value: string
  onChange: (hex: string) => void
  /** Accessible name of the group. */
  label: string
  className?: string
}

/** A row of 10 px swatches; the chosen one carries a 1 px ink ring. Buttons are named `Colour #hex`. */
export function ColourSwatchPicker({
  value,
  onChange,
  label,
  className
}: ColourSwatchPickerProps): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-1', className)} role="group" aria-label={label}>
      {COLOUR_SWATCHES.map((c) => {
        const selected = value.toLowerCase() === c
        return (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            aria-pressed={selected}
            onClick={() => onChange(c)}
            className="flex size-8 items-center justify-center rounded-sm hover:bg-hover"
          >
            <span
              className={cn(
                'size-2.5 rounded-full',
                selected && 'outline outline-1 outline-offset-2 outline-ink'
              )}
              style={{ backgroundColor: userColor(c) }}
              aria-hidden="true"
            />
          </button>
        )
      })}
    </div>
  )
}
