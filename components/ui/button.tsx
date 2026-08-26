import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent-strong text-on-accent hover:brightness-95",
        outline: "border border-[var(--color-muted)] bg-surface text-ink hover:bg-sunken",
        ghost: "text-ink hover:bg-sunken",
        destructive: "bg-destructive text-on-destructive hover:brightness-95",
        // A destructive TRIGGER, as distinct from a destructive confirmation. The filled
        // variant above belongs on the button that actually does the deleting, inside a
        // confirmation dialog; using it for the trigger makes "Remove from household" the
        // loudest object on a page whose primary action is "Save changes". Destructive text on
        // a plain surface measures 6.12:1 light / 6.11:1 dark, so the quieter treatment costs
        // no legibility.
        destructiveOutline: "border border-destructive/40 bg-surface text-destructive hover:bg-destructive-bg",
      },
      size: {
        default: "min-h-[44px] px-5 py-2",
        sm: "min-h-[44px] px-4 text-sm",
        lg: "min-h-[52px] px-7 text-base",
        icon: "min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
