import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Design-Spec §8.10: a wall-mode launcher. `/wall` already exists (app/wall/**, out of this
 * task's touchable set) -- this pane is just the real, working entry point the settings nav
 * promises, not a placeholder for a screen that isn't built yet.
 */
export default function SettingsWallDisplayPage() {
  return (
    <div className="glass flex flex-col items-start gap-4 rounded-card px-5 py-5">
      <div>
        <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text">Wall display</h2>
        <p className="mt-1 text-[14px] text-text-secondary">
          A fullscreen kiosk view for a kitchen tablet -- clock, weather, and your family, always visible.
        </p>
      </div>
      <Button asChild>
        <Link href="/wall">Open wall display</Link>
      </Button>
    </div>
  );
}
