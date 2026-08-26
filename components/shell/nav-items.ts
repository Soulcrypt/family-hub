import { FEATURES, type EnabledFeatures, type FeatureKey } from "@/lib/constants/features";

/**
 * `icon` is a plain string KEY, never a lucide component. This module is imported by both a
 * Server Component (app/(app)/layout.tsx, which calls `navItemsFor()`) and the Client
 * Components that render its result. A component reference is a function, functions are not
 * serializable across the RSC boundary, and passing one 500'd every route under `(app)` with
 * "Functions cannot be passed directly to Client Components". The icon map lives client-side,
 * in the components that render it.
 */
export type NavIconKey =
  | "home"
  | "meals"
  | "calendar"
  | "chores"
  | "ivy"
  | "photos"
  | "budget"
  | "family"
  | "settings";

export type NavItem = { href: string; label: string; icon: NavIconKey; feature: FeatureKey | null };

/**
 * Display order — Design-Spec §5: "Home · Meals · Calendar · Chores · Ivy · Photos · Budget".
 *
 * Family and Settings are deliberately NOT here. §5 puts them behind the profile avatar
 * ("Overflow screens (Photos, Budget, Settings) via profile avatar top-right → sheet"), so
 * they are reached from the account menu rather than competing with the feature nav.
 */
const ALL: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home", feature: null },
  { href: "/meals", label: "Meals", icon: "meals", feature: "meals" },
  { href: "/calendar", label: "Calendar", icon: "calendar", feature: "calendar" },
  { href: "/chores", label: "Chores", icon: "chores", feature: "chores" },
  { href: "/ivy", label: "Ivy", icon: "ivy", feature: "ivy" },
  { href: "/photos", label: "Photos", icon: "photos", feature: "photos" },
  { href: "/budget", label: "Budget", icon: "budget", feature: "budget" },
];

const LOCKED_FEATURES: ReadonlySet<FeatureKey> = new Set(
  FEATURES.filter((feature) => feature.locked).map((feature) => feature.key),
);

/**
 * Turns a household's enabled-feature flags into the ordered nav items to render.
 *
 * `null`-feature items (Home) always appear; locked features always appear; everything else
 * appears once its flag is `true`.
 *
 * Note what is NOT a condition here any more: whether the screen is built. Every route in
 * `ALL` resolves — the unbuilt ones render `components/shell/coming-soon.tsx`, an honest
 * empty state in the spec's own §6 language, rather than a 404. That keeps the invariant the
 * regression test in tests/e2e/family.spec.ts pins ("the navigation never offers a link that
 * doesn't resolve") while letting the nav match the spec'd shape from day one, instead of
 * hiding a feature the household explicitly turned on.
 */
export function navItemsFor(features: EnabledFeatures): NavItem[] {
  return ALL.filter((item) => {
    if (item.feature === null) return true;
    if (LOCKED_FEATURES.has(item.feature)) return true;
    return features[item.feature] === true;
  });
}

/**
 * The five the phone dock shows — Design-Spec §5: "Five 48px circular items (Home, Meals, Cal,
 * Chores, Ivy)". Anything beyond those five is reached through the profile avatar, so unlike
 * the old bottom bar there is no overflow disclosure to keep in sync: the dock is a fixed
 * five, and the account sheet is the complete escape hatch.
 */
const DOCK_ORDER: readonly string[] = ["/dashboard", "/meals", "/calendar", "/chores", "/ivy"];

export function dockItemsFor(features: EnabledFeatures): NavItem[] {
  const enabled = navItemsFor(features);
  return DOCK_ORDER.map((href) => enabled.find((item) => item.href === href)).filter(
    (item): item is NavItem => item !== undefined,
  );
}

/** Short labels for the dock — §5 specifies "Cal", not "Calendar", at 9px. */
export const DOCK_LABELS: Record<string, string> = {
  "/dashboard": "Home",
  "/meals": "Meals",
  "/calendar": "Cal",
  "/chores": "Chores",
  "/ivy": "Ivy",
};
