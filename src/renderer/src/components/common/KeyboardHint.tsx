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

/** A shortcut as plain 13 px ink-3 text, per platform (`⌘K` on macOS, `Ctrl+K` elsewhere). No key caps. */
export function KeyboardHint({ shortcut, className }: KeyboardHintProps): React.JSX.Element {
  const { isMac } = usePlatform()
  const keys = shortcutKeys(shortcut, isMac)
  return (
    <span
      className={cn('inline-flex items-center text-xs text-ink-3', className)}
      aria-label={formatShortcutLabel(shortcut, isMac)}
    >
      {keys.map((key, index) => (
        <Fragment key={`${key}-${index}`}>
          {index > 0 && !isMac && <span aria-hidden="true">+</span>}
          <Kbd aria-hidden="true">{key}</Kbd>
        </Fragment>
      ))}
    </span>
  )
}
