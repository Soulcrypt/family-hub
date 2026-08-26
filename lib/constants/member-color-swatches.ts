/**
 * Member identity colours — Design-Spec §2.2.
 *
 * Fixed per person and used for avatars, calendar event bars and chore dots. All pastel, so
 * they read on both themes; the spec pins the first three to the household and offers the rest
 * for future members.
 *
 * Every value takes INK as its foreground (measured against `member-avatar.tsx`'s own
 * `foregroundFor()` algorithm, not asserted by eye):
 *   Cody       #B6E6B0 -> ink 11.97:1
 *   Elizabeth  #F3B3D4 -> ink  9.79:1
 *   Ivy        #FFD08A -> ink 11.73:1
 *   Sky        #9AD0FF -> ink 10.29:1
 *   Lilac      #C9B8F5 -> ink  9.34:1
 *   Sand       #F5D48A -> ink 11.75:1
 *
 * That uniformity is the point: because these are all light pastels, the avatar's foreground
 * never flips between ink and white as members are added, so a family strip stays visually
 * consistent instead of alternating dark and light initials.
 *
 * Spec §10: "Member color is never the only signal — always paired with name or avatar."
 */
export type MemberColorSwatch = { name: string; hex: string };

export const MEMBER_COLOR_SWATCHES = [
  { name: "Sage", hex: "#B6E6B0" },
  { name: "Blossom", hex: "#F3B3D4" },
  { name: "Amber", hex: "#FFD08A" },
  { name: "Sky", hex: "#9AD0FF" },
  { name: "Lilac", hex: "#C9B8F5" },
  { name: "Sand", hex: "#F5D48A" },
] as const satisfies readonly MemberColorSwatch[];

/** The swatch a brand-new member starts on when nothing is known about the rest of the
 * household — the first palette entry, named rather than indexed so
 * `noUncheckedIndexedAccess` doesn't force a non-null assertion at every call site. */
export const DEFAULT_MEMBER_COLOR: string = MEMBER_COLOR_SWATCHES[0].hex;

/**
 * The colour a newly-added member should START on, given who is already in the household.
 *
 * Defaulting every new member to the same swatch quietly defeats the only job member colour
 * has. A parent adding three children in a row, accepting the default each time, ends up with
 * three identical circles — and the switcher, the family strip and the dashboard all lean on
 * colour to tell people apart at a glance across a kitchen. So the default walks the palette
 * instead: the first swatch nobody is using yet.
 *
 * Falls back to cycling once every swatch is taken (a household larger than the palette), so a
 * seventh member gets a repeat rather than nothing — a duplicate is worse than distinct, but far
 * better than an empty or invalid colour, and they can still pick.
 */
export function nextAvailableMemberColor(usedColors: readonly string[]): string {
  const used = new Set(usedColors.map((color) => color.toUpperCase()));
  const free = MEMBER_COLOR_SWATCHES.find((swatch) => !used.has(swatch.hex.toUpperCase()));
  if (free) return free.hex;
  const cycled = MEMBER_COLOR_SWATCHES[usedColors.length % MEMBER_COLOR_SWATCHES.length];
  return cycled ? cycled.hex : DEFAULT_MEMBER_COLOR;
}
