import { CalendarDays, Home, ListChecks, Settings, Sparkles, Users, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FEATURES, type EnabledFeatures, type FeatureKey } from "@/lib/constants/features";

export type NavItem = { href: string; label: string; icon: LucideIcon; feature: FeatureKey | null };

const ALL: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, feature: null },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, feature: "calendar" },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed, feature: "meals" },
  { href: "/chores", label: "Chores", icon: ListChecks, feature: "chores" },
  { href: "/habits", label: "Habits", icon: Sparkles, feature: "habits" },
  { href: "/family", label: "Family", icon: Users, feature: "family" },
  { href: "/settings", label: "Settings", icon: Settings, feature: "settings" },
];

// `family` and `settings` are `locked: true` in the FEATURES catalogue (lib/constants/features.ts)
// -- every household gets them, they are not a real onboarding choice. Looking that up here
// rather than trusting the incoming `features` map to already have them set to `true` means an
// empty, malformed, or partially-written `household_settings.enabled_features` row (a
// hand-edit, a row that predates a later feature, a lookup that came back null) can never
// produce a navigation with no way back to Family or Settings -- only the OPTIONAL features
// (calendar, meals, chores, habits) are ever gated on the stored flags.
const LOCKED_FEATURES: ReadonlySet<FeatureKey> = new Set(
  FEATURES.filter((feature) => feature.locked).map((feature) => feature.key),
);

/**
 * Pure function turning a household's enabled-feature flags into the ordered list of nav
 * items to render. `null`-feature items (Home) and locked-feature items (Family, Settings)
 * always appear; everything else appears only once its flag is `true`. Order in `ALL` is the
 * nav's display order, so keep Settings last there if you add a new feature.
 */
export function navItemsFor(features: EnabledFeatures): NavItem[] {
  return ALL.filter((item) => {
    if (item.feature === null) return true;
    if (LOCKED_FEATURES.has(item.feature)) return true;
    return features[item.feature] === true;
  });
}
