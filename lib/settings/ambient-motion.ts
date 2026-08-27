/**
 * The "Ambient animations" preference (Settings > Appearance, mock 4h) — a REAL, read-and-honored
 * toggle, not the household accent-color picker this project already shipped once with a control
 * that changed nothing anywhere in the app (see app/(app)/settings/appearance/page.tsx's doc
 * comment for that history). This module is the single read/write path so the toggle
 * (components/settings/ambient-motion-toggle.tsx) and the effect that actually applies it
 * (components/settings/ambient-motion-effect.tsx) can never disagree on the storage key, the
 * stored representation, or the default.
 *
 * Stored in `localStorage`, not a household/member database column: this is a per-DEVICE
 * preference (whether ambient motion is welcome on THIS screen — e.g. a wall-mounted tablet
 * someone wants perfectly still — same reasoning `next-themes` already uses for the theme
 * choice this app makes client-side rather than server-side).
 *
 * Independent of, and additive with, `prefers-reduced-motion`: turning this OFF stops the
 * app's own ambient motion (aurora drift, staggered entrances) even for a visitor whose OS
 * hasn't asked for reduced motion; leaving it ON never overrides a genuine OS-level
 * `prefers-reduced-motion: reduce`, which the app already honors unconditionally
 * (app/globals.css's global kill-switch). Design-Spec §7.4.
 */
export const AMBIENT_MOTION_STORAGE_KEY = "hearth:ambient-motion";

type StoredValue = "on" | "off";

function isStoredValue(value: string | null): value is StoredValue {
  return value === "on" || value === "off";
}

/**
 * Reads the current preference. Defaults to `true` (ambient motion on, matching Design-Spec
 * §7.2's "alive by default") when nothing has been stored yet, storage is unavailable (a
 * private/locked-down browsing context can throw on access), or the stored value is anything
 * other than the two this module ever writes — a hand-edited or stale value degrades to the
 * default rather than throwing.
 */
export function readAmbientMotionPreference(): boolean {
  try {
    const raw = window.localStorage.getItem(AMBIENT_MOTION_STORAGE_KEY);
    if (!isStoredValue(raw)) return true;
    return raw === "on";
  } catch {
    return true;
  }
}

/** Persists an explicit choice. Silently no-ops if storage is unavailable — the in-memory
 * effect this session still applies the choice; only surviving a reload is lost. */
export function writeAmbientMotionPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(AMBIENT_MOTION_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // See doc comment above.
  }
}
