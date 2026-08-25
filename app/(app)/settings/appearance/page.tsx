import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * Hosts the per-device theme toggle. `ThemeToggle` itself is never gated -- every viewer,
 * including a non-admin profile, can pick their own light/dark/system preference (it's stored
 * client-side by next-themes, not a household setting).
 *
 * DEFERRED, deliberately not built here: a household accent-color override
 * (`household_settings.theme_defaults`, an existing but so-far-unused `Json` column). An
 * earlier draft of this page persisted one via a color-picker control with no visible effect
 * anywhere in the app -- a control that appears to work and changes nothing is worse than no
 * control at all, so it was removed rather than shipped half-wired. The real requirement for
 * whoever builds this (flagged during this task's review, and recorded here so it isn't
 * rediscovered): the pinned brand accent fails AA for normal text at 4.01:1 against this
 * theme's cream background, which is exactly why `--color-accent-strong` (a derived, darker
 * token) exists alongside the plain `--color-accent` in app/globals.css. A user-chosen accent
 * needs that SAME per-color derivation -- computed at save time, not assumed -- the way
 * `components/family/member-avatar.tsx` already derives a legible per-fill foreground color
 * for an arbitrary member color. This belongs with the identity/theming work already deferred
 * to Task 19, not bolted on here without that derivation.
 */
export default function SettingsAppearancePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl">Appearance</h1>
        <p className="mt-1 text-muted-foreground">Light, dark, or match your device.</p>
      </header>
      <div className="flex flex-col gap-3 rounded-[18px] bg-surface px-5 py-5 shadow-elevation ring-1 ring-[color:var(--color-muted)]">
        <h2 className="text-lg font-medium text-ink">Theme</h2>
        <ThemeToggle />
      </div>
    </div>
  );
}
