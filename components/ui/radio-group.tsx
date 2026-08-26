"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Bare Radix radio-group primitives -- no visual opinion of their own (unlike shadcn's stock
 * dot-and-circle styling), because the one consumer today (components/family/color-picker.tsx)
 * needs each `RadioGroupItem` to render as a full color swatch, not a dot. `RadioGroupPrimitive`
 * bubbles a hidden native `type="radio"` input per item when inside a `<form>` (see
 * @radix-ui/react-radio-group's `RadioGroupItemBubbleInput`), so `name`/`value`/`defaultValue`
 * here participate in a Server Action's `FormData` exactly like the raw `<input type="color">`
 * it replaces.
 */
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function RadioGroupIndicator({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Indicator>) {
  return (
    <RadioGroupPrimitive.Indicator
      data-slot="radio-group-indicator"
      className={cn(className)}
      {...props}
    />
  )
}

export { RadioGroup, RadioGroupItem, RadioGroupIndicator }
