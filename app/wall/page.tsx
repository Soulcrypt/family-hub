import { redirect } from "next/navigation";
import { Aurora } from "@/components/shell/aurora";
import { MemberAvatar } from "@/components/family/member-avatar";
import { getAccountMembership } from "@/lib/auth/active-member";
import { createServerClient } from "@/lib/supabase/server";
import { WallClient } from "./wall-client";

/**
 * Wall mode — Design-Spec §5 and mock `docs/design/hearth/mockups/2i.png`. A kitchen tablet in
 * landscape: clock and weather header, three glance tiles, family footer.
 *
 * Lives OUTSIDE the `(app)` route group on purpose. §5 is explicit that wall mode has no
 * navigation, and `(app)/layout.tsx` renders the top bar and the dock; putting this route
 * inside it would inherit both.
 *
 * It renders its own `<Aurora deep />` over the root layout's. Both are `fixed -z-10` in the
 * same stacking context, so the later element in the DOM paints on top — which is how this
 * route gets `--color-base-deep` (#08090C, the darkest surface in the app, §2.3) without the
 * root layout needing to know wall mode exists.
 *
 * The three glance tiles are honest empty states rather than the mock's dinner/next-up/chores
 * content: meals, calendar and chores are not built yet, and a wall display showing invented
 * dinners would be actively misleading — someone would plan an evening around it.
 */
export default async function WallPage() {
  const membership = await getAccountMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createServerClient();
  const [{ data: household }, { data: members }] = await Promise.all([
    supabase.from("households").select("name, timezone").eq("id", membership.household_id).maybeSingle(),
    supabase
      .from("household_members")
      .select("id, display_name, color, avatar_url")
      .eq("household_id", membership.household_id)
      .eq("is_active", true)
      .order("created_at"),
  ]);

  return (
    <>
      <Aurora deep />
      <WallClient timeZone={household?.timezone ?? "UTC"}>
        {/* §4: wall tiles use radius 26 and >= 56px targets. */}
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            { label: "Dinner", body: "no meal planned yet" },
            { label: "Up next", body: "no calendar connected yet" },
            { label: "Up for grabs", body: "no chores yet" },
          ].map((tile) => (
            <section
              key={tile.label}
              className="dashed flex min-h-[160px] flex-col justify-between rounded-[26px] p-6"
            >
              <h2 className="text-[13px] font-bold uppercase tracking-[0.07em] text-text-secondary">
                {tile.label}
              </h2>
              <p className="text-[17px] text-text-secondary">{tile.body}</p>
            </section>
          ))}
        </div>

        <footer className="mt-10 flex items-center gap-4">
          <span className="flex items-center">
            {(members ?? []).map((member, index) => (
              <span
                key={member.id}
                className="rounded-full ring-2 ring-[color:var(--color-base-deep)]"
                style={{ marginLeft: index === 0 ? 0 : -8 }}
              >
                <MemberAvatar
                  displayName={member.display_name}
                  color={member.color}
                  avatarUrl={member.avatar_url}
                  size="sm"
                  ariaHidden
                />
              </span>
            ))}
          </span>
          <p className="text-[15px] text-text-secondary">{household?.name ?? "Your household"}</p>
        </footer>
      </WallClient>
    </>
  );
}
