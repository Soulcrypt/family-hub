import type { WidgetKey } from "@/lib/constants/features";

export type { WidgetKey };

export type WidgetSize = "primary" | "secondary";

export type WidgetMeta = {
  key: WidgetKey;
  label: string;
  /**
   * Design-Spec §8.1 / §4: the dashboard's default row is asymmetric -- a 1.25fr/1fr "primary"
   * row (schedule, dinner) then a compact 3-up "secondary" row (weather, photos, news), "avoid
   * uniform 3-up monotony". A widget's size is a property of what it IS (a wide event list and
   * a featured recipe card read very differently from a compact stat tile), not a per-household
   * preference -- so it lives in this registry, never in the persisted per-member layout
   * (member_dashboard_layouts.widgets is just an ordered key list). Reordering
   * (lib/dashboard/layout.ts's `moveWithinGroup`) only ever happens WITHIN a size group as a
   * result.
   */
  size: WidgetSize;
};

export const WIDGET_REGISTRY: Record<WidgetKey, WidgetMeta> = {
  schedule: { key: "schedule", label: "Today", size: "primary" },
  dinner: { key: "dinner", label: "Tonight's dinner", size: "primary" },
  weather: { key: "weather", label: "Weather", size: "secondary" },
  photos: { key: "photos", label: "Photos", size: "secondary" },
  news: { key: "news", label: "Local news", size: "secondary" },
};

/** The full widget catalogue, in the product's canonical order -- currently identical to
 * `DEFAULT_WIDGETS` (lib/constants/features.ts) because every widget this build knows about is
 * also one of the five defaults, but derived from THIS registry's own keys rather than
 * re-exporting that constant, so a future widget added only here doesn't have to also be added
 * to the default set to become addable from the drawer. */
export const ALL_WIDGET_KEYS: readonly WidgetKey[] = Object.keys(WIDGET_REGISTRY) as WidgetKey[];
