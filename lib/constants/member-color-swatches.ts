/**
 * Preset swatches for a `household_members.color` value -- the app's own replacement for the
 * raw `<input type="color">` OS well (design-review fix: see components/family/color-picker.tsx,
 * the sole consumer). Every value here must clear 4.5:1 against whichever of ink (#2A2520) /
 * white components/family/member-avatar.tsx's `foregroundFor()` would pick for it -- verified
 * in lib/__tests__/member-color-swatches.test.ts, which mirrors that algorithm rather than
 * importing it (foregroundFor is private to that module).
 *
 * The first four reuse supabase/seed.sql's own already-verified values as-is. The schema's own
 * default, `#C4643C`, is deliberately excluded: white-on-it only reaches ~4.0:1 -- AA for large
 * text, a genuine fail at 16px/normal weight (see member-avatar.tsx's `foregroundFor` doc
 * comment for the same finding).
 *
 * Ratios below (best of white/ink, computed by this task, not just asserted by the test):
 *   Plum        #7C4A6B -> white 6.89:1
 *   Teal        #2F6F7A -> white 5.71:1
 *   Gold        #E8B44A -> ink   7.99:1
 *   Dusty Rose  #C98A96 -> ink   5.46:1
 *   Sienna      #9C4A2E -> white 6.12:1
 *   Moss        #4F6D4A -> white 5.80:1
 *   Umber       #5B4636 -> white 8.85:1
 *   Raspberry   #8B4A5A -> white 6.51:1
 */
export type MemberColorSwatch = { name: string; hex: string };

export const MEMBER_COLOR_SWATCHES = [
  { name: "Plum", hex: "#7C4A6B" },
  { name: "Teal", hex: "#2F6F7A" },
  { name: "Gold", hex: "#E8B44A" },
  { name: "Dusty Rose", hex: "#C98A96" },
  { name: "Sienna", hex: "#9C4A2E" },
  { name: "Moss", hex: "#4F6D4A" },
  { name: "Umber", hex: "#5B4636" },
  { name: "Raspberry", hex: "#8B4A5A" },
] as const satisfies readonly MemberColorSwatch[];

/** The swatch a brand-new member (added via a dialog, before they've picked their own) starts
 * on -- the first palette entry, named rather than indexed so `noUncheckedIndexedAccess`
 * doesn't force a non-null assertion at every call site. */
export const DEFAULT_MEMBER_COLOR: string = MEMBER_COLOR_SWATCHES[0].hex;
