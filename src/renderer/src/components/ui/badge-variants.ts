import { cva, type VariantProps } from 'class-variance-authority'

export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-1.5 py-px text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        destructive: 'border-transparent bg-destructive/12 text-destructive',
        /** Tinted chip coloured by `--chip` (set through `chipStyle(token)`); used for statuses and categories. */
        status: 'chip-tint chip-border'
      }
    },
    defaultVariants: {
      variant: 'secondary'
    }
  }
)

export type BadgeVariantProps = VariantProps<typeof badgeVariants>
