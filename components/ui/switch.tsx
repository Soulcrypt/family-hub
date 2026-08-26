"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Styled in the app's own accent (`bg-accent-strong`), not the browser default's system blue --
 * see the design-review fix that introduced this file: raw `<input type="checkbox">` rows in
 * Household Settings' Features list rendered in system blue, the only blue anywhere in an
 * otherwise warm palette. Radix's `Switch` bubbles a hidden native `type="checkbox"` input
 * (see @radix-ui/react-switch's `SwitchBubbleInput`) whenever it sits inside a `<form>`, so
 * `name`/`value`/`defaultChecked` here participate in a Server Action's `FormData` exactly the
 * way the raw checkbox it replaces did -- verified end-to-end via tests/e2e/settings.spec.ts's
 * (a sibling task's file, not this one's) features round trip.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent-strong data-[state=unchecked]:bg-[var(--color-muted)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow-xs ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5 dark:data-[state=unchecked]:bg-[var(--color-surface)]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
