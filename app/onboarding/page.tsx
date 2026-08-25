import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getAccountMembership } from "@/lib/auth/active-member";
import { finishOnboardingAction } from "./actions";
import { StepHousehold } from "@/components/onboarding/step-household";
import { StepMembers, type OnboardingMember } from "@/components/onboarding/step-members";
import { StepFeatures } from "@/components/onboarding/step-features";
import { Button } from "@/components/ui/button";
import { parseEnabledFeatures } from "@/lib/constants/features";

type Search = { step?: string };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { step = "welcome" } = await searchParams;

  // `/onboarding` is not in proxy.ts's PUBLIC_PATHS, so an unauthenticated visitor never
  // reaches this render at all -- the proxy already redirected them to /welcome. This lookup
  // exists purely to branch on whether a household already exists (resumability), not to
  // gate authentication.
  const membership = await getAccountMembership();

  // Resumable: a visitor who already created a household is bounced straight past both
  // "welcome" and "household" -- re-showing either would risk minting a SECOND household
  // (createHouseholdAction guards this too, but this is what stops a browser-back or a
  // stale/bookmarked link from ever reaching that form). A real redirect() rather than just
  // swapping this render's content for the members step: the latter would leave the address
  // bar reading "step=household"/no step at all while the screen shows the members step,
  // which breaks exactly what "resumable" is supposed to mean -- reload, or share the URL,
  // and land back on what you're actually looking at.
  if ((step === "welcome" || step === "household") && membership) {
    redirect("/onboarding?step=members");
  }

  if (step === "welcome") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-6 text-center">
        <h1 className="text-4xl">Welcome to Family Hub</h1>
        <p className="text-lg text-muted">Four short steps and your household is ready.</p>
        <form method="get">
          <input type="hidden" name="step" value="household" />
          <Button type="submit" size="lg">
            Get started
          </Button>
        </form>
      </main>
    );
  }

  if (step === "household") return <StepHousehold />;

  // Every remaining step needs a household to operate on.
  if (!membership) redirect("/onboarding?step=household");

  if (step === "members") {
    const supabase = await createServerClient();
    const { data: members } = await supabase
      .from("household_members")
      .select("id, display_name, role, color")
      .eq("household_id", membership.household_id)
      .order("created_at");
    return <StepMembers members={(members ?? []) as OnboardingMember[]} />;
  }

  if (step === "features") {
    const supabase = await createServerClient();
    const { data: settings } = await supabase
      .from("household_settings")
      .select("enabled_features")
      .eq("household_id", membership.household_id)
      .maybeSingle();
    return <StepFeatures enabledFeatures={parseEnabledFeatures(settings?.enabled_features)} />;
  }

  const supabase = await createServerClient();
  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", membership.household_id)
    .single();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-6 text-center">
      <h1 className="text-4xl">You&apos;re ready</h1>
      <p className="text-lg text-muted">
        {household?.name ?? "Your household"} is set up. You can change any of this later in Settings.
      </p>
      <form action={finishOnboardingAction}>
        <Button type="submit" size="lg">
          Go to my dashboard
        </Button>
      </form>
    </main>
  );
}
