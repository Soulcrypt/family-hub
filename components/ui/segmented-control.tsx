"use client";

import { cn } from "@/lib/utils";

/**
 * Design-Spec §6 "Radio/segmented": "pill segmented control — container
 * `rgba(255,255,255,.08)` pill, active segment = white fill + dark text (see calendar
 * Week/Month, Agenda/Week)." First consumer is the sign-in/create-account switch
 * (components/auth/auth-form.tsx), but this is deliberately generic — the spec names two more
 * consumers (calendar view toggles) that don't exist yet, so it takes plain
 * value/onChange/options rather than anything auth-shaped.
 *
 * Built on real `<input type="radio">` elements (one hidden, native input per option) rather
 * than a row of clickable `<div>`s: Design-Spec §10 requires "a real radio group or tablist,
 * not clickable divs" for exactly this control. Native radios give free keyboard behavior
 * (arrow keys move selection within a shared `name` group) and a real accessible name per
 * option with no extra ARIA wiring. `role="radiogroup"` + `aria-label` on the wrapper names the
 * group itself for a screen reader, matching the native `<fieldset>/<legend>` pattern without
 * the visual reset a real fieldset would need.
 *
 * The input is visually hidden (opacity-0, absolutely positioned over its label) rather than
 * `sr-only`'d off in a corner — it must stay exactly where the pointer expects the pill to be,
 * so a click or tap on the visible label still lands on the real control. Focus is surfaced via
 * `has-[:focus-visible]`, keeping `:focus-visible`'s native keyboard-only visibility instead of
 * showing the ring on every pointer click too.
 */
export type SegmentedControlOption<T extends string = string> = {
  value: T;
  label: string;
};

export type SegmentedControlProps<T extends string = string> = {
  name: string;
  ariaLabel: string;
  value: T;
  options: readonly SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedControl<T extends string = string>({
  name,
  ariaLabel,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-pill bg-glass-hover p-[3px]", className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "relative flex min-h-[38px] cursor-pointer items-center justify-center rounded-pill px-[18px] text-[12px] font-bold whitespace-nowrap transition-colors duration-150 select-none",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              checked ? "bg-white text-[#0C0D10]" : "text-text-secondary hover:text-text",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
