import { redirect } from "next/navigation";
import {
  getMembershipStatus,
  MembershipLookupUnavailableError,
  MultipleHouseholdMembershipsError,
} from "@/lib/auth/active-member";

export default async function IndexPage() {
  const status = await getMembershipStatus();

  switch (status.status) {
    case "unauthenticated":
      return redirect("/welcome");
    case "none":
      return redirect("/onboarding");
    case "found":
      return redirect("/dashboard");
    case "multiple":
      // A genuinely ambiguous account (more than one active household_members row) — same
      // treatment getAccountMembership() callers get elsewhere: surface it as an error rather
      // than silently picking a household to redirect into.
      throw new MultipleHouseholdMembershipsError();
    case "unavailable":
      // auth.getUser() itself failed, so it's UNKNOWN whether this visitor is signed out or
      // signed in with a household — redirecting either way risks the wrong outcome (see
      // MembershipLookupUnavailableError's doc comment). Surface it instead of guessing.
      throw new MembershipLookupUnavailableError(status.cause);
  }
}
