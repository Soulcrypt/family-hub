import { FEATURES, type EnabledFeatures, type FeatureKey } from "@/lib/constants/features";

/**
 * Task 13 fix: this module is imported by BOTH a Server Component (app/(app)/layout.tsx,
 * which calls `navItemsFor()`) and the Client Components that render its result (Sidebar,
 * BottomNav). It used to store the actual lucide-react icon COMPONENT on each `NavItem`
 * (`icon: LucideIcon`) -- a function -- and pass that across the server/client boundary as a
 * prop. React Server Components can only serialize plain data across that boundary; a
 * function/component reference is not serializable, and `/family` (the first route to ever
 * render this shell -- see this task's report) 500'd on every request with "Functions cannot
 * be passed directly to Client Components" the instant it did.
 *
 * The fix: `icon` is now a plain string KEY. The actual lucide-react components are imported
 * and resolved entirely CLIENT-SIDE, inside Sidebar and BottomNav themselves (each keeps its
 * own `ICONS: Record<NavIconKey, LucideIcon>` map) -- nothing but serializable data ever
 * crosses the boundary.
 */
export type NavIconKey = "home" | "calendar" | "meals" | "chores" | "habits" | "family" | "settings";

export type NavItem = { href: string; label: string; icon: NavIconKey; feature: FeatureKey | null };

const ALL: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home", feature: null },
  { href: "/calendar", label: "Calendar", icon: "calendar", feature: "calendar" },
  { href: "/meals", label: "Meals", icon: "meals", feature: "meals" },
  { href: "/chores", label: "Chores", icon: "chores", feature: "chores" },
  { href: "/habits", label: "Habits", icon: "habits", feature: "habits" },
  { href: "/family", label: "Family", icon: "family", feature: "family" },
  { href: "/settings", label: "Settings", icon: "settings", feature: "settings" },
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
