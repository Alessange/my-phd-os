import {
  cloneElement,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode
} from 'react'
import { cn } from '@renderer/lib/utils'

type SlotProps = HTMLAttributes<HTMLElement> & { children?: ReactNode; ref?: unknown }

/**
 * Minimal `asChild` helper: merges the wrapper's props (className, handlers, aria-*) into its single
 * child element. `@radix-ui/react-slot` is only a transitive dependency here, so it is not imported.
 */
export function Slot({ children, className, ...props }: SlotProps): React.JSX.Element | null {
  if (!isValidElement(children)) return null
  const child = children as ReactElement<HTMLAttributes<HTMLElement>>
  const merged: Record<string, unknown> = { ...props }
  Object.entries(child.props).forEach(([key, value]) => {
    const own = (props as Record<string, unknown>)[key]
    if (/^on[A-Z]/.test(key) && typeof own === 'function' && typeof value === 'function') {
      merged[key] = (...args: unknown[]) => {
        ;(value as (...a: unknown[]) => void)(...args)
        ;(own as (...a: unknown[]) => void)(...args)
      }
    } else if (key === 'className') {
      merged.className = cn(className, value as string)
    } else if (key === 'style' && typeof own === 'object' && own !== null) {
      merged.style = { ...(own as object), ...(value as object) }
    } else {
      merged[key] = value
    }
  })
  if (merged.className === undefined && className) merged.className = className
  return cloneElement(child, merged)
}
