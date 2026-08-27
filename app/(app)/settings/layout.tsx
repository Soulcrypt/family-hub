import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";

/**
 * Design-Spec §8.10 / mock 4h: a left section nav (Family · Calendars · Notifications ·
 * Appearance · Wall display · Data & export) with the content pane beside it on desktop,
 * stacked above it on phone. Every `/settings/*` route this task owns renders as `children`
 * here — `SettingsNav` itself decides which item is current from the URL (usePathname), so
 * this layout stays a thin, page-agnostic frame.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-[30px] font-bold tracking-[-0.02em] text-text">Settings</h1>
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
