import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Design-Spec §6 "Forms & inputs": `surface/inset` fill, hairline border, radius 14, height 48
 * (44 on desktop), 15px text, placeholder in `text/tertiary`.
 *
 * Focus is the spec's exact recipe — a 1.5px accent border plus a 3px `rgba(10,132,255,.25)`
 * ring — and the spec is emphatic about it: "Never remove focus outlines." That is why the
 * ring is on the element itself rather than left to the global `:focus-visible` outline: an
 * input's focus state has to read as *this field is live*, not just *something has focus*.
 *
 * 16px on phones is deliberate and is not a design choice — iOS Safari zooms the viewport when
 * a focused input's text is under 16px, which on a form would jump the whole page. The spec's
 * 15px applies from `sm` up, where no such zoom happens.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-[14px] border border-hairline bg-inset px-4 text-base outline-none",
        "text-text placeholder:text-text-tertiary",
        "transition-[border-color,box-shadow] duration-150",
        "focus-visible:border-[1.5px] focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent-ring",
        "aria-invalid:border-danger aria-invalid:ring-[3px] aria-invalid:ring-danger/25",
        "disabled:pointer-events-none disabled:opacity-40",
        "sm:h-11 sm:text-[15px]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
