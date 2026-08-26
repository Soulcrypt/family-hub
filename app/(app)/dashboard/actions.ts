"use server";

import { revalidatePath } from "next/cache";
import { requireAccountMembership } from "@/lib/auth/active-member";
import { createServerClient } from "@/lib/supabase/server";
import { sanitizeWidgetKeys } from "@/lib/dashboard/layout";
import type { WidgetKey } from "@/lib/constants/features";

export type SaveDashboardLayoutResult = { ok: true } | { ok: false; error: string };

/**
 * Persists a member's dashboard widget layout -- Design-Spec §8.1's "Widget system: per-member
 * layout stored as jsonb," backing `member_dashboard_layouts`
 * (supabase/migrations/0020_dashboard_widget_layout.sql). Called by widget-grid.tsx after every
 * remove/add/reorder in edit mode; the client applies the change optimistically and this just
 * makes it durable.
 *
 * `memberId` is deliberately a PARAMETER, not re-derived from the caller's own session, because
 * the whole point of a per-member layout on a shared kiosk is that any signed-in household
 * member can edit a login-less fellow member's layout (Ivy cannot open this drawer herself --
 * see the migration's doc comment). `requireAccountMembership()` still proves the caller is a
 * genuine, authenticated member of SOME household before anything is written; the database's
 * own RLS policies (`dashboard_layouts_insert_household`/`_update_household`) are what actually
 * enforce that `memberId` belongs to the CALLER'S household, exactly the way every other
 * Server Action in this codebase treats RLS as the real boundary rather than duplicating that
 * check in application code and hoping it never drifts from the policy.
 *
 * `widgets` is sanitized (unknown keys dropped, duplicates removed) via `sanitizeWidgetKeys`
 * rather than `parseWidgetLayout` -- the latter falls back to the full default set on an empty
 * result, which is right for READING a layout that might not exist yet, but wrong here: a
 * member who deliberately removed every widget in the editor must be able to save that, not
 * have it silently repopulated.
 */
export async function saveDashboardLayoutAction(memberId: string, widgets: WidgetKey[]): Promise<SaveDashboardLayoutResult> {
  const account = await requireAccountMembership();
  const supabase = await createServerClient();

  const sanitized = sanitizeWidgetKeys(widgets);

  const { error } = await supabase.from("member_dashboard_layouts").upsert(
    {
      member_id: memberId,
      household_id: account.household_id,
      widgets: sanitized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );

  if (error) {
    console.error("[dashboard] failed to save widget layout", error);
    return { ok: false, error: "couldn't save your widget layout -- please try again" };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
