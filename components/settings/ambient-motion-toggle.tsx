"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { readAmbientMotionPreference, writeAmbientMotionPreference } from "@/lib/settings/ambient-motion";
import { applyAmbientMotionPreference } from "@/components/settings/ambient-motion-effect";

/**
 * The "Ambient animations" toggle (mock 4h, Settings > Appearance). Unlike the household
 * accent-color picker this project already shipped once with a control that changed nothing
 * anywhere in the app (app/(app)/settings/appearance/page.tsx's doc comment), flipping this
 * calls `applyAmbientMotionPreference()` synchronously — the aurora drift and any staggered
 * entrance this app renders stop or resume in the SAME tab immediately, not just after a
 * reload or in other tabs (which pick it up via the `storage` event `AmbientMotionEffect`
 * listens for).
 *
 * Defaults to "on" (matching Design-Spec §7.2 "alive by default") until this effect resolves
 * the real stored value on mount — `mounted` avoids a hydration mismatch, the same pattern
 * `components/theme/theme-toggle.tsx` already uses for the theme radios, since the stored
 * preference is only ever knowable client-side.
 */
/** A single piece of state (rather than two separate `useState` calls) so the mount effect
 * below only ever calls `setState` once — two independent `setState` calls in one effect body
 * would trigger a cascading extra render, which `react-hooks/set-state-in-effect` flags. */
type ResolvedPreference = { mounted: boolean; enabled: boolean };

export function AmbientMotionToggle() {
  const [{ mounted, enabled }, setResolved] = useState<ResolvedPreference>({ mounted: false, enabled: true });

  useEffect(() => {
    // Resolving the real, client-only stored preference on mount (see the doc comment above);
    // matches components/theme/theme-toggle.tsx's identical mount-flag pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved({ mounted: true, enabled: readAmbientMotionPreference() });
  }, []);

  function handleChange(next: boolean) {
    setResolved({ mounted: true, enabled: next });
    writeAmbientMotionPreference(next);
    applyAmbientMotionPreference(next);
  }

  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor="ambient-animations">Ambient animations</Label>
        <p className="text-[13px] text-text-secondary">
          The background glow drift and card entrances. Off also skips them for reduced-motion visitors, in addition
          to your device&rsquo;s own setting.
        </p>
      </div>
      <Switch
        id="ambient-animations"
        checked={mounted ? enabled : true}
        onCheckedChange={handleChange}
        aria-label="Ambient animations"
      />
    </div>
  );
}
