"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Hydration-safe mount flag: next-themes only knows the resolved theme on
  // the client, so we render an unchecked group on the server and flip this
  // once mounted to avoid a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Roving tabindex (APG radio-group pattern): only the selected option is a
  // Tab stop; before mount (or if the theme is unresolved) fall back to the
  // first option so the group always has exactly one reachable Tab stop.
  const selectedIndex = mounted ? OPTIONS.findIndex((option) => option.value === theme) : -1;
  const tabbableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function moveTo(nextIndex: number) {
    const option = OPTIONS[nextIndex];
    if (!option) return;
    setTheme(option.value);
    buttonRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveTo((index + 1) % OPTIONS.length);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveTo((index - 1 + OPTIONS.length) % OPTIONS.length);
        break;
      default:
        break;
    }
  }

  return (
    <div role="radiogroup" aria-label="Color theme" className="inline-flex gap-1 rounded-[14px] bg-sunken p-1">
      {OPTIONS.map(({ value, label, Icon }, index) => (
        <button
          key={value}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          type="button"
          role="radio"
          aria-checked={mounted ? theme === value : false}
          aria-label={label}
          tabIndex={index === tabbableIndex ? 0 : -1}
          onClick={() => setTheme(value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={cn(
            "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] transition-colors",
            mounted && theme === value ? "bg-surface text-accent" : "text-muted hover:text-ink",
          )}
        >
          <Icon size={18} aria-hidden />
        </button>
      ))}
    </div>
  );
}
