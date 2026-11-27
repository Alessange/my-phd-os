import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Buttons (DESIGN.md section 6). One ink primary per view; everything else is a ghost or a text
 * link. Old variant names map onto the new look so existing call sites keep working:
 *   default     -> ink fill (the primary)
 *   outline     -> ghost (no border any more)
 *   secondary   -> ghost, ink-2 text
 *   ghost       -> ghost
 *   destructive -> ghost with signal text (menus, left-aligned "Delete" in a footer)
 *   danger      -> solid signal fill; ONLY for the confirm button of an alertdialog
 *   link        -> ink text with a 1 px underline
 * Disabled: the primary drops to the quiet muted ground with ink-4 text (no grey slab); every
 * other variant fades to 50%.
 * Sizes: sm 32 high (toolbar, strip), md 36 (default, dialogs), lg 40, icon 32 square.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-sm text-sm whitespace-nowrap transition-colors duration-100 select-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 disabled:bg-muted disabled:text-ink-4',
        secondary: 'text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-50',
        outline: 'text-ink hover:bg-hover disabled:opacity-50',
        ghost: 'text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-50',
        destructive: 'text-signal hover:bg-hover disabled:opacity-50',
        danger:
          'bg-signal text-signal-ink hover:bg-signal/90 active:bg-signal/80 disabled:opacity-50',
        link: 'rounded-none text-ink underline decoration-ink/45 decoration-1 underline-offset-4 hover:decoration-ink disabled:opacity-50'
      },
      size: {
        sm: 'h-8 px-3.5',
        md: 'h-9 px-3.5',
        lg: 'h-10 px-4',
        icon: 'size-8'
      }
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
