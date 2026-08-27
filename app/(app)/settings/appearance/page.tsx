import { ThemeSegmentedControl } from "@/components/settings/theme-segmented-control";
import { AmbientMotionToggle } from "@/components/settings/ambient-motion-toggle";

/**
 * Design-Spec §8.10/§6, mock 4h: theme as a proper Auto/Light/Dark segmented control, plus the
 * "Ambient animations" toggle. Never gated -- every viewer, admin or not, can pick their own
 * theme and motion preference (both are stored client-side, not a household setting).
 *
 * DEFERRED, deliberately not built here: a household accent-color override
 * (`household_settings.theme_defaults`, an existing but so-far-unused `Json` column). An
 * earlier draft of this page persisted one via a color-picker control with no visible effect
 * anywhere in the app -- a control that appears to work and changes nothing is worse than no
 * control at all, so it was removed rather than shipped half-wired. The real requirement for
 * whoever builds this (flagged during that task's review, and recorded here so it isn't
 * rediscovered): the pinned brand accent needs the SAME per-color AA-contrast derivation
 * `components/family/member-avatar.tsx` already performs for an arbitrary member color. This
 * belongs with the identity/theming work already deferred to Task 19, not bolted on here.
 *
 * "Ambient animations", by contrast, IS wired for real this time -- see
 * `components/settings/ambient-motion-toggle.tsx` and `ambient-motion-effect.tsx` for how it
 * actually disables the aurora drift and staggered entrances, and this file's own report for
 * exactly how far that reach extends given this task's file boundaries.
 */
export default function SettingsAppearancePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="glass flex flex-col gap-4 rounded-card px-5 py-5">
        <div>
          <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text">Appearance</h2>
          <p className="mt-1 text-[14px] text-text-secondary">Auto matches your device.</p>
        </div>
        <ThemeSegmentedControl />
      </section>

      <section className="glass rounded-card px-5 py-5">
        <AmbientMotionToggle />
      </section>
    </div>
  );
}
