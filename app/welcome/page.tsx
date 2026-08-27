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
        {/* Sized in CSS rather than through the `size` prop so it can scale with the
            viewport: a welcome screen on a 1280px kitchen display was rendering the same
            76px mark as a phone. CSS width/height override an SVG's presentation
            attributes, so the prop's default is just a floor. Deliberately larger than
            mock 4a, which measures 76px -- the screen has the room and the mark earns it. */}
        <HearthMark className="size-28 sm:size-32 lg:size-40" />
        <div>
          <h1 className="text-[34px] font-bold tracking-[-0.03em] text-text">Hearth</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
            Your family, in one
            <br />
            calm place.
          </p>
        </div>
        <p className="text-xs text-text-secondary">Meals · calendar · chores · Ivy · photos</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button asChild size="lg">
          <Link href="/signup">Create your household</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/login">Sign in</Link>
        </Button>
        {/* `text-secondary`, not `text-tertiary`. Tertiary is 3.29:1 light / 3.18:1 dark and cannot
            carry text at all — app/globals.css documents it as non-essential meta only, and the
            token test asserts it stays below 4.5:1 precisely so it does not creep into copy
            like this. axe caught both of these lines on /welcome. */}
        <p className="mt-1 text-center text-[11.5px] text-text-secondary">
          Works offline · installs like an app
        </p>
      </div>
    </main>
  );
}
