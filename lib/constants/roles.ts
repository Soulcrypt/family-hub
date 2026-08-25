import type { Database } from "@/lib/supabase/types";

export type MemberRole = Database["public"]["Enums"]["member_role"];

export const ROLES = ["owner", "parent", "teen", "child"] as const satisfies readonly MemberRole[];

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  parent: "Parent",
  teen: "Teen",
  child: "Child",
};
