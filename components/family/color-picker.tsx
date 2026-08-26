"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { RadioGroup, RadioGroupItem, RadioGroupIndicator } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { MemberAvatar } from "@/components/family/member-avatar";
import { MEMBER_COLOR_SWATCHES } from "@/lib/constants/member-color-swatches";
import { cn } from "@/lib/utils";

export type ColorPickerProps = {
  /** Distinguishes swatch/legend element ids across multiple pickers on one page (this form's
   * own Color field vs. the "Add a family member" dialog's, which can both be mounted at once). */
  idPrefix: string;
  /** The form field name this radio group's hidden bubble input submits under. */
  name: string;
  defaultValue: string;
  /** Drives the live avatar preview's initial letter -- purely cosmetic, never submitted. */
  displayName: string;
  disabled?: boolean;
};

/**
 * The app's own warm swatch palette, replacing the raw `<input type="color">` OS well (design
 * review: "the delight moment currently being spent on a browser widget"). A proper radio
 * group (WAI-ARIA radiogroup/radio, not a row of clickable `<div>`s) -- see
 * components/ui/radio-group.tsx's doc comment for why it's unstyled Radix rather than shadcn's
 * stock dot styling, and for how selection still reaches a Server Action's `FormData` with no
 * extra wiring (Radix bubbles a hidden native `type="radio"` input per swatch).
 *
 * The live preview re-renders `MemberAvatar` with whichever swatch is currently selected --
 * `onValueChange` drives local state for this alone; the `RadioGroup` itself stays uncontrolled
 * (`defaultValue`, not `value`) so it keeps behaving like any other native form control inside
 * these forms (e.g. a dialog's `formRef.current?.reset()` on success).
 */
export function ColorPicker({ idPrefix, name, defaultValue, displayName, disabled }: ColorPickerProps) {
  const [selected, setSelected] = React.useState(defaultValue);
  const legendId = `${idPrefix}-color-legend`;

  return (
    <div className="flex flex-col gap-3">
      <Label id={legendId}>Color</Label>
      <div className="flex items-center gap-4">
        <MemberAvatar displayName={displayName.trim() || "?"} color={selected} size="md" ariaHidden />
        <RadioGroup
          aria-labelledby={legendId}
          name={name}
          defaultValue={defaultValue}
          onValueChange={setSelected}
          disabled={disabled}
          className="grid grid-cols-4 gap-3"
        >
          {MEMBER_COLOR_SWATCHES.map((swatch) => (
            <RadioGroupItem
              key={swatch.hex}
              value={swatch.hex}
              id={`${idPrefix}-color-${swatch.hex.slice(1)}`}
              aria-label={swatch.name}
              style={{ backgroundColor: swatch.hex }}
              className={cn(
                "relative flex size-11 items-center justify-center rounded-full ring-1 ring-black/10 transition-transform hover:scale-105 data-[state=checked]:ring-2 data-[state=checked]:ring-accent-strong data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-surface",
              )}
            >
              <RadioGroupIndicator>
                <span className="flex size-5 items-center justify-center rounded-full bg-white shadow-xs">
                  <Check className="size-3.5 text-ink" aria-hidden />
                </span>
              </RadioGroupIndicator>
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
