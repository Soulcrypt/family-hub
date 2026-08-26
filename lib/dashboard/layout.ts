import { DEFAULT_WIDGETS, type WidgetKey } from "@/lib/constants/features";
import { ALL_WIDGET_KEYS, WIDGET_REGISTRY, type WidgetSize } from "@/lib/dashboard/widget-meta";

const VALID_KEYS: ReadonlySet<string> = new Set(ALL_WIDGET_KEYS);

function isWidgetKey(value: unknown): value is WidgetKey {
  return typeof value === "string" && VALID_KEYS.has(value);
}

/** De-duplicates and drops unrecognized keys, preserving first-occurrence order. An arbitrary
 * (non-array) input degrades to `[]` rather than throwing. No fallback to `DEFAULT_WIDGETS`
 * here -- unlike `parseWidgetLayout` below, this is also what `saveDashboardLayoutAction`
 * (app/(app)/dashboard/actions.ts) sanitizes an EDIT with, where a genuinely empty result
 * (a member who removed every widget) must stay empty, not silently repopulate the defaults. */
export function sanitizeWidgetKeys(value: unknown): WidgetKey[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<WidgetKey>();
  const out: WidgetKey[] = [];
  for (const item of value) {
    if (isWidgetKey(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/**
 * Parses a `member_dashboard_layouts.widgets` jsonb value -- or any other arbitrary input, since
 * this also has to tolerate "no row yet" (a member who has never customized their layout) --
 * into a de-duplicated, known-key-only ordered list. Falls back to `DEFAULT_WIDGETS` whenever
 * the value is missing, malformed, or resolves to nothing usable, so a fresh member's dashboard
 * always starts at the same five widgets onboarding promised, never a blank screen.
 */
export function parseWidgetLayout(value: unknown): WidgetKey[] {
  const sanitized = sanitizeWidgetKeys(value);
  return sanitized.length > 0 ? sanitized : [...DEFAULT_WIDGETS];
}

/** The catalogue's widgets not currently present in `current` -- the "+ Add" drawer's
 * contents, always in registry order so the drawer doesn't reshuffle as items come and go. */
export function remainingWidgets(current: WidgetKey[]): WidgetKey[] {
  const present = new Set(current);
  return ALL_WIDGET_KEYS.filter((key) => !present.has(key));
}

export function removeWidget(current: WidgetKey[], key: WidgetKey): WidgetKey[] {
  return current.filter((existing) => existing !== key);
}

/** Appends `key` to the end -- which, since rendering groups by `WIDGET_REGISTRY[key].size`
 * while preserving `current`'s relative order (see widget-grid.tsx), lands it last within its
 * own size group without needing any group-aware insertion logic here. A no-op if already
 * present. */
export function addWidget(current: WidgetKey[], key: WidgetKey): WidgetKey[] {
  if (current.includes(key)) return current;
  return [...current, key];
}

function groupIndices(current: WidgetKey[], group: WidgetSize): number[] {
  const indices: number[] = [];
  current.forEach((key, index) => {
    if (WIDGET_REGISTRY[key]?.size === group) indices.push(index);
  });
  return indices;
}

/**
 * Moves `key` one step earlier/later among widgets sharing its size group ("primary"/
 * "secondary" -- see widget-meta.ts's doc comment for why reordering is scoped to a group
 * rather than the whole list). A no-op at either end of its group.
 *
 * This is a plain array transform meant to sit behind "Move earlier"/"Move later" BUTTONS
 * (widget-grid.tsx) -- Design-Spec §10 requires full keyboard navigation, and a drag-only
 * reorder control would exclude keyboard and switch users entirely. Pointer drag, if ever
 * added, would be a second way to call this same function, not a replacement for it.
 */
export function moveWithinGroup(current: WidgetKey[], key: WidgetKey, direction: "earlier" | "later"): WidgetKey[] {
  const group = WIDGET_REGISTRY[key]?.size;
  const keyIndex = current.indexOf(key);
  if (!group || keyIndex === -1) return current;

  const indices = groupIndices(current, group);
  const posInGroup = indices.indexOf(keyIndex);
  const targetPos = direction === "earlier" ? posInGroup - 1 : posInGroup + 1;
  if (targetPos < 0 || targetPos >= indices.length) return current;

  const otherIndex = indices[targetPos];
  if (otherIndex === undefined) return current;

  const next = [...current];
  const a = next[keyIndex];
  const b = next[otherIndex];
  if (a === undefined || b === undefined) return current;
  next[keyIndex] = b;
  next[otherIndex] = a;
  return next;
}

export function isFirstInGroup(current: WidgetKey[], key: WidgetKey): boolean {
  const group = WIDGET_REGISTRY[key]?.size;
  const keyIndex = current.indexOf(key);
  if (!group || keyIndex === -1) return true;
  return groupIndices(current, group)[0] === keyIndex;
}

export function isLastInGroup(current: WidgetKey[], key: WidgetKey): boolean {
  const group = WIDGET_REGISTRY[key]?.size;
  const keyIndex = current.indexOf(key);
  if (!group || keyIndex === -1) return true;
  const indices = groupIndices(current, group);
  return indices[indices.length - 1] === keyIndex;
}
