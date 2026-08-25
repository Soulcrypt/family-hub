import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getAccountMembership } from "@/lib/auth/active-member";

export default async function IndexPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/welcome");

  const membership = await getAccountMembership();
  redirect(membership ? "/dashboard" : "/onboarding");
}
