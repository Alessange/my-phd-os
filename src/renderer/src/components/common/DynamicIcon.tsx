import type { LucideProps } from 'lucide-react'
import { createElement } from 'react'
import { iconByName } from '@renderer/lib/icons'

export interface DynamicIconProps extends LucideProps {
  /** lucide component name as stored in `constants/{statuses,categories}.ts`. */
  name: string
}

/** Renders a lucide icon chosen by name at runtime (status / category definitions). */
export function DynamicIcon({ name, ...props }: DynamicIconProps): React.JSX.Element {
  return createElement(iconByName(name), { 'aria-hidden': true, ...props })
}
