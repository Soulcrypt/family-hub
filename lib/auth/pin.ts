import bcrypt from "bcryptjs";

const ROUNDS = 10;

/**
 * Hashes a member's PIN for storage in `household_members.pin_hash`. The PIN itself is never
 * persisted — only this salted hash is. Used by the profile switcher's PIN gate (Task 12,
 * `verifyPin`) and by a member setting their own PIN (Task 13's `setPinAction`).
 *
 * This is a CONVENIENCE lock, not the security boundary: it stops a child wandering into a
 * parent's profile on the shared tablet. It grants no authority by itself — see
 * lib/auth/permissions.ts's `requiresPin` doc comment and app/switch/actions.ts.
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, ROUNDS);
}

/**
 * Verifies a PIN against a stored hash. Returns `false` — never throws — when `hash` is
 * `null`, which is the normal state for a member who has not set a PIN yet, so a caller can
 * treat "no PIN set" and "wrong PIN" identically without a separate null check.
 */
export async function verifyPin(pin: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}
