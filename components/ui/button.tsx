import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Design-Spec §6 "Buttons". Pill-shaped throughout (radius 99 — the spec's only button shape),
 * spring-eased, scale .97 on press.
 *
 * `default` fills with `--color-accent-strong` (#0073E8) rather than the identity accent
 * #0A84FF. The spec asks for white 13/700 on #0A84FF, which measures 3.65:1 — an AA failure at
 * that size, and one the spec's own §10 ("all text >= 4.5:1") contradicts. The darker fill
 * along the same hue clears it at 4.53:1. #0A84FF survives untouched everywhere it is NOT
 * behind text: borders, rings, indicators, the active dock circle.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold transition-[background-color,color,border-color,filter,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[.97] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-accent-strong text-on-accent hover:brightness-110",
        // §6 "On-tint primary": inside an accent-tinted card, a blue fill would vanish into the
        // tint, so the button inverts to white-on-dark instead.
        onTint: "bg-white text-[#0C0D10] hover:brightness-95",
        secondary: "bg-glass-hover text-text border border-hairline hover:bg-glass-hover",
        ghost: "text-accent-text hover:brightness-110",
        // §6 "Destructive: ghost in danger; confirm via sheet, never instant." The filled
        // treatment belongs on the confirmation itself, not on the trigger that opens it.
        destructive: "bg-danger text-on-accent hover:brightness-110",
        destructiveOutline: "border border-danger/40 bg-transparent text-danger-text hover:bg-danger/10",
      },
      size: {
        // §4: >= 44px hit target everywhere. Phone primaries are taller per §6 (14x28).
        default: "min-h-[44px] px-[18px] py-[10px] text-[13px]",
        sm: "min-h-[44px] px-4 text-[12px]",
        lg: "min-h-[52px] px-7 text-[15px]",
        wall: "min-h-[56px] px-8 text-[15px]",
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
