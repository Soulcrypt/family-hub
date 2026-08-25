"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { friendlyClaimError } from "./friendly-error";

export type ClaimState = { error: string | null };

/**
 * The ONLY place `accept_invite` is ever called from the app (Task 14 fix round 3). It used to
 * run directly inside `app/invite/[token]/page.tsx`'s render -- a plain GET -- which meant a
 * signed-in visitor's own browser or client prefetching a hovered/visible invite link could
 * silently burn a real, single-use invitation before the person ever decided to click
 * anything. Claiming is irreversible (the token cannot be reused once `accepted_at` is set), so
 * this now only ever runs from an explicit form submit
 * (components/invite/confirm-claim-form.tsx), triggered by a person pressing "Join the
 * household" after seeing exactly what they're about to join
 * (app/invite/[token]/page.tsx calls the read-only `preview_invite` RPC to render that).
 *
 * Every guard that decides whether the token is genuinely redeemable by THIS caller (expiry,
 * reuse, cross-household member_id mismatch, already-claimed, already-a-member of this
 * household (active or removed), already-a-member of a different household) still lives
 * entirely inside `accept_invite` itself -- this action does not reimplement, duplicate, or
 * pre-check any of it. It only calls the RPC and turns whatever it decides into either a
 * redirect or a form error.
 */
export async function confirmClaimAction(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const rawToken = formData.get("token");
  const token = typeof rawToken === "string" ? rawToken : "";
  if (!token) return { error: friendlyClaimError("invitation not found") };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) return { error: friendlyClaimError(error.message) };

  redirect("/dashboard");
}
