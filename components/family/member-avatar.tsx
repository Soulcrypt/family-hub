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

const SIZE_PX = { sm: 40, md: 64, lg: 96 } as const;

export type MemberAvatarSize = keyof typeof SIZE_PX;

export type MemberAvatarProps = {
  displayName: string;
  color: string;
  avatarUrl?: string | null;
  size?: MemberAvatarSize;
  ariaHidden?: boolean;
};

export function MemberAvatar({
  displayName,
  color,
  avatarUrl = null,
  size = "md",
  ariaHidden = false,
}: MemberAvatarProps) {
  const px = SIZE_PX[size];
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  const a11yProps = ariaHidden ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": displayName };

  return (
    <span
      {...a11yProps}
      style={{
        width: px,
        height: px,
        backgroundColor: avatarUrl ? undefined : color,
        fontSize: Math.round(px * 0.4),
      }}
      className="relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-on-accent"
    >
      {avatarUrl ? (
        // A fixed-size circular portrait; next/image's responsive-sizing machinery buys nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="font-medium">
          {initial}
        </span>
      )}
    </span>
  );
}
