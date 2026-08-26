import Link from "next/link";
import { featureFor, type FeatureKey } from "@/lib/constants/features";

/**
 * The screen behind a nav link whose feature hasn't been built yet.
 *
 * This exists so the navigation can show the shape Design-Spec §5 specifies without ever
 * offering a link that 404s — the invariant `tests/e2e/family.spec.ts` pins. It is an honest
 * empty state, not a mock: it says the screen isn't here, and never renders placeholder data
 * dressed up as content.
 *
 * Styled per §6 "Empty states": dashed border, centred, one line in `text/secondary` plus an
 * accent action. No illustrations, no mascots — the spec is explicit about both.
 */
export function ComingSoon({ feature }: { feature: FeatureKey }) {
  const entry = featureFor(feature);
  const label = entry?.label ?? feature;

  return (
    <div className="mx-auto w-full max-w-[1140px] px-5 py-10 sm:px-10">
      <h1 className="text-[26px] font-bold tracking-[-0.02em] sm:text-[30px]">{label}</h1>
      <p className="mt-1 text-[15px] text-text-secondary">{entry?.description}</p>

      <div className="dashed mt-8 flex flex-col items-center gap-3 rounded-card px-6 py-16 text-center">
        <p className="text-[15px] text-text-secondary">
          {label} isn’t built yet — it’s next up.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex min-h-[44px] items-center rounded-pill px-4 text-[13px] font-bold text-accent-text transition-[filter] duration-150 hover:brightness-110"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
