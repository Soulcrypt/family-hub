"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Hydration-safe mount flag: next-themes only knows the resolved theme on
  // the client, so we render an unchecked group on the server and flip this
  // once mounted to avoid a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div role="radiogroup" aria-label="Color theme" className="inline-flex gap-1 rounded-[12px] bg-sunken p-1">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={mounted ? theme === value : false}
          aria-label={label}
          onClick={() => setTheme(value)}
          className={cn(
            "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] transition-colors",
            mounted && theme === value ? "bg-surface text-accent" : "text-muted hover:text-ink",
          )}
        >
          <Icon size={18} aria-hidden />
        </button>
      ))}
    </div>
  );
}
