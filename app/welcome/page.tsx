import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HearthMark } from "@/components/brand/hearth-mark";

/**
 * Mock 4a. First screen an unauthenticated visitor sees (proxy.ts redirects here). One <h1>
 * ("Hearth" itself, per Design-Spec §10), the mark, tagline and feature line centered, two
 * pinned-bottom actions and the offline/installable caption underneath — mirrors the mock's
 * layout of a centered hero over a bottom action stack rather than the app's usual
 * scroll-then-actions pattern, since there is nothing else on this screen to scroll to.
 */
export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <HearthMark size={76} />
        <div>
          <h1 className="text-[34px] font-bold tracking-[-0.03em] text-text">Hearth</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
            Your family, in one
            <br />
            calm place.
          </p>
        </div>
        <p className="text-xs text-text-tertiary">Meals · calendar · chores · Ivy · photos</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button asChild size="lg">
          <Link href="/signup">Create your household</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/login">Sign in</Link>
        </Button>
        <p className="mt-1 text-center text-[11.5px] text-text-tertiary">Works offline · installs like an app</p>
      </div>
    </main>
  );
}
