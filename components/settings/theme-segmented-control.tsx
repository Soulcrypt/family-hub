"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { SegmentedControl } from "@/components/ui/segmented-control";

const OPTIONS = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

type ThemeValue = (typeof OPTIONS)[number]["value"];

/**
 * Design-Spec §6/§8.10: theme as a proper segmented control ("Auto / Light / Dark"), not the
 * icon-button radiogroup `components/theme/theme-toggle.tsx` renders elsewhere (that component
 * lives under components/theme/**, outside this task's touchable set, and labels its third
 * option "System" rather than the spec's "Auto" — a cosmetic difference only, both drive the
 * same next-themes `setTheme`). This wraps the SAME `useTheme()` hook and the app's own
 * `SegmentedControl` (components/ui/segmented-control.tsx, already Hearth-styled) so Settings >
 * Appearance matches mock 4h exactly while every OTHER theme control in the app keeps working
 * unchanged — next-themes' `ThemeProvider` (mounted once, outside this task's files) is the
 * single source of truth either reads from.
 *
 * `mounted` avoids a hydration mismatch: next-themes only knows the resolved theme after the
 * client mounts (see `theme-toggle.tsx`'s identical comment) — before that, this renders "system"
 * selected as a safe default matching the app's actual default theme.
 */
export function ThemeSegmentedControl() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const value: ThemeValue = mounted && (theme === "light" || theme === "dark") ? theme : "system";

  return (
    <SegmentedControl
      name="theme"
      ariaLabel="Theme"
      value={value}
      options={OPTIONS}
      onChange={(next) => setTheme(next)}
    />
  );
}
