import { Fragment } from 'react'
import { Kbd } from '@renderer/components/ui/kbd'
import { usePlatform } from '@renderer/hooks/usePlatform'
import { formatShortcutLabel, shortcutKeys } from '@renderer/lib/shortcutLabel'
import { cn } from '@renderer/lib/utils'

export interface KeyboardHintProps {
  /** `mod+K`, `mod+1`, `T`, `Escape`. */
  shortcut: string
  className?: string
}

/** Renders a shortcut as key caps, per platform (⌘K on macOS, Ctrl+K elsewhere). */
export function KeyboardHint({ shortcut, className }: KeyboardHintProps): React.JSX.Element {
  const { isMac } = usePlatform()
  const keys = shortcutKeys(shortcut, isMac)
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-label={formatShortcutLabel(shortcut, isMac)}
    >
      {keys.map((key, index) => (
        <Fragment key={`${key}-${index}`}>
          {index > 0 && !isMac && <span className="text-[10px] text-muted-foreground">+</span>}
          <Kbd aria-hidden="true">{key}</Kbd>
        </Fragment>
      ))}
    </span>
  )
}
