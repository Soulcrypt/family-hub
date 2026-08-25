import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { canEditSettings, isAdminProfile } from "@/lib/auth/permissions";
import { createServerClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AccentForm } from "@/components/settings/accent-form";

const DEFAULT_ACCENT = "#C4643C";

/**
 * `household_settings.theme_defaults` is an untyped `Json` column with no fixed shape at the
 * database boundary -- narrows it into just the one key this page reads, the same
 * "anything unexpected degrades to nothing chosen" spirit as
 * lib/constants/features.ts's `parseEnabledFeatures`.
 */
function parseAccent(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const accent = (value as Record<string, unknown>).accent;
  return typeof accent === "string" && /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : null;
}

/**
 * Hosts the per-device theme toggle and the household's accent-color override. `ThemeToggle`
 * itself is never gated -- every viewer, including a non-admin profile, can pick their own
 * light/dark/system preference (it's stored client-side by next-themes, not a household
 * setting) -- only the accent override below is admin-gated, matching
 * app/(app)/settings/household/page.tsx's identical `canEdit` derivation.
 */
export default async function SettingsAppearancePage() {
  const account = await requireAccountMembership();
  const activeMember = await getActiveMember();
  const supabase = await createServerClient();

  const { data: settings } = await supabase
    .from("household_settings")
    .select("theme_defaults")
    .eq("household_id", account.household_id)
    .maybeSingle();

  const canEdit = canEditSettings(account.role) && isAdminProfile(activeMember?.role ?? account.role);
  const accent = parseAccent(settings?.theme_defaults) ?? DEFAULT_ACCENT;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl">Appearance</h1>
        <p className="mt-1 text-muted-foreground">Light, dark, or match your device.</p>
      </header>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-[18px] bg-surface px-5 py-5 shadow-elevation ring-1 ring-[color:var(--color-muted)]">
          <h2 className="text-lg font-medium text-ink">Theme</h2>
          <ThemeToggle />
        </div>
        <AccentForm accent={accent} canEdit={canEdit} />
      </div>
    </div>
  );
}
