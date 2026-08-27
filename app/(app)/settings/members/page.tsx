import { redirect } from "next/navigation";

/**
 * Superseded by `/settings` (the Family pane, app/(app)/settings/page.tsx), which now owns the
 * member roster, invite affordances, and the removed-members restore list this route used to
 * hold on its own -- see FamilyRoster's doc comment. Kept as a redirect rather than deleted so
 * an old bookmark/link still lands somewhere useful instead of a 404.
 */
export default function SettingsMembersRedirectPage() {
  redirect("/settings");
}
