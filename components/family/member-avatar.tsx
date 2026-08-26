/**
 * A member's circular portrait: their `avatar_url` when set, otherwise the first initial of
 * `displayName` on a fill of their `color`. Server-safe (no client hooks/state) so it can be
 * dropped into any Server Component -- introduced for the profile switcher (Task 12) but its
 * API is meant to outlive that: Task 13's family screens and Task 16's dashboard consume it
 * too, so keep this component's props stable rather than switcher-specific.
 *
 * `ariaHidden` covers the two ways this renders next to a member's name:
 *  - `true` (decorative): the surrounding UI already names the member in text (e.g. a tile
 *    whose visible label is the member's name) -- the avatar carries no separate accessible
 *    name, so a screen reader doesn't announce the member twice.
 *  - `false` (default, standalone): nothing else on screen names the member, so the avatar
 *    itself gets `role="img"` and an `aria-label` of the member's name.
 */

// Design-Spec §6: avatars are circles at the member's identity colour, with the initial
// shown at >= 36px. `xs` exists for the top bar's overlapping stack (§5), which sits below
// that threshold and therefore renders as a plain colour disc with no initial.
const SIZE_PX = { xs: 28, sm: 40, md: 64, lg: 96, xl: 128 } as const;

export type MemberAvatarSize = keyof typeof SIZE_PX;

export type MemberAvatarProps = {
  displayName: string;
  color: string;
  avatarUrl?: string | null;
  size?: MemberAvatarSize;
  ariaHidden?: boolean;
  /**
   * Renders the avatar at reduced opacity -- used by the top bar's family stack to show who
   * is NOT the currently-attributed member. Never the only signal: the active member is also
   * named in the account sheet, per spec §10 ("Member color is never the only signal").
   */
  dimmed?: boolean;
};

// The site's light-theme ink and a plain white -- fixed literals, not theme tokens. This
// swatch fills the whole circle independent of the page's own theme (a member's chosen
// `color` isn't a theme value), so there's no "current theme" to match here; the near-black
// ink reads well against a light background regardless of which theme the surrounding page is
// in, exactly the way `WHITE` does against a dark one.
const INK = "#2A2520";
const WHITE = "#FFFFFF";

/**
 * WCAG relative luminance (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance) of a
 * `#RRGGBB` hex color. `household_members.color` is DB-constrained to that exact 6-digit
 * shape, but a malformed value here degrades to black (luminance 0) rather than throwing --
 * this only ever affects which of two already-legible foregrounds gets picked, never whether
 * the avatar renders at all.
 */
function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return 0;
  const [rHex, gHex, bHex] = [match[1], match[2], match[3]];
  if (!rHex || !gHex || !bHex) return 0;
  const [r, g, b] = [rHex, gHex, bHex].map((component) => {
    const channel = parseInt(component, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE_LUMINANCE = 1;
const INK_LUMINANCE = relativeLuminance(INK);

/**
 * Picks whichever of `INK`/`WHITE` contrasts better against a given fill color, rather than
 * always using white text. A fixed white foreground on the default `#C4643C` fill sits at
 * ~4.0:1 -- AA for the `lg` initial's large text, but a genuine fail at `sm` (16px, normal
 * weight) -- and a member free to choose ANY `<input type="color">` value can pick something
 * pale enough (e.g. yellow) to make white-on-fill effectively invisible (~1.1:1).
 */
function foregroundFor(fill: string): string {
  const fillLuminance = relativeLuminance(fill);
  const contrastWithWhite = contrastRatio(fillLuminance, WHITE_LUMINANCE);
  const contrastWithInk = contrastRatio(fillLuminance, INK_LUMINANCE);
  return contrastWithWhite >= contrastWithInk ? WHITE : INK;
}

export function MemberAvatar({
  displayName,
  color,
  avatarUrl = null,
  size = "md",
  ariaHidden = false,
  dimmed = false,
}: MemberAvatarProps) {
  const px = SIZE_PX[size];
  // Spreading the string (not `.charAt(0)`) iterates by Unicode code point, so a name starting
  // with an astral character (most emoji, some scripts) yields that whole character instead of
  // one half of its UTF-16 surrogate pair (which renders as `�`).
  const initial = [...displayName.trim()][0]?.toUpperCase() ?? "?";
  const foreground = foregroundFor(color);

  const a11yProps = ariaHidden ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": displayName };

  return (
    <span
      {...a11yProps}
      style={{
        width: px,
        height: px,
        backgroundColor: color,
        color: foreground,
        fontSize: Math.round(px * 0.4),
        opacity: dimmed ? 0.45 : 1,
      }}
      className="relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold"
    >
      {/* The color fill above is unconditional -- not just the `avatarUrl`-absent branch's
          background -- so a broken/unreachable avatarUrl degrades to the same colored-initial
          appearance, never an invisible empty circle. */}
      {avatarUrl ? (
        // A fixed-size circular portrait; next/image's responsive-sizing machinery buys nothing here.
        //
        // Deliberately NOT `loading="lazy"`. Every place this component renders puts it above the
        // fold on first paint -- the profile switcher's tiles (app/switch/page.tsx), the
        // dashboard's family strip, the sidebar's active member -- and the switcher is the
        // primary screen of a wall-mounted kitchen tablet. Lazy-loading a handful of small
        // circular images there buys no scroll savings and costs a visible pop-in on exactly the
        // screen people glance at from across the room.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" width={px} height={px} className="h-full w-full object-cover" />
      ) : (
        // §6: "initial optional at >= 36px". Below that there is no room for a legible glyph,
        // and a squeezed one reads as noise rather than identity -- the disc alone is the avatar.
        px >= 36 ? (
          <span aria-hidden="true">{initial}</span>
        ) : null
      )}
    </span>
  );
}
