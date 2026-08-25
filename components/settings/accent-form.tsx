"use client";

import { useActionState } from "react";
import { updateAppearanceAction, type SettingsState } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const INITIAL: SettingsState = { error: null };

/**
 * The household's accent-color override. Gated on `canEdit` (same combined authority + active-
 * profile check as HouseholdSettingsForm -- see app/(app)/settings/appearance/page.tsx). A
 * non-editing viewer still sees the current swatch, just not a control to change it.
 */
export function AccentForm({ accent, canEdit }: { accent: string; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(updateAppearanceAction, INITIAL);

  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-surface px-5 py-5 shadow-elevation ring-1 ring-[color:var(--color-muted)]">
      <div>
        <h2 className="text-lg font-medium text-ink">Household accent</h2>
        <p className="text-sm text-muted-foreground">A custom accent color for your household.</p>
      </div>

      {canEdit ? (
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="accent">Accent color</Label>
            <input
              id="accent"
              name="accent"
              type="color"
              defaultValue={accent}
              disabled={pending}
              className="h-11 w-16 cursor-pointer rounded-[12px] border border-[var(--color-muted)] bg-transparent p-1 disabled:opacity-50"
            />
          </div>
          {state.error ? (
            <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Saving…" : "Save accent"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-6 shrink-0 rounded-full ring-1 ring-[color:var(--color-muted)]"
            style={{ backgroundColor: accent }}
          />
          <span className="text-sm text-muted-foreground">Only a parent or owner can change this.</span>
        </div>
      )}
    </div>
  );
}
