"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CircleCheck,
  Home,
  type LucideIcon,
  Baby,
  UtensilsCrossed,
} from "lucide-react";
import { DOCK_LABELS, type NavIconKey, type NavItem } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<NavIconKey, LucideIcon>> = {
  home: Home,
  meals: UtensilsCrossed,
  calendar: CalendarDays,
  chores: CircleCheck,
  ivy: Baby,
};

/**
 * Phone navigation — Design-Spec §5 "floating dock": a pill 18px above the safe area,
 * `rgba(28,29,34,.85)` + blur 20, five 48px circular items, active one a filled `#0A84FF`
 * circle with a white icon and 9px/700 label.
 *
 * "Dock hides on scroll-down, returns on scroll-up (250ms spring)" — implemented against the
 * scroll DELTA rather than an absolute position, so it behaves the same on a short screen that
 * barely scrolls as on a long one. A small threshold stops it flickering on the sub-pixel
 * scroll jitter iOS produces during rubber-banding.
 *
 * The dock is always re-shown when the route changes: arriving on a new screen with the
 * navigation hidden, because you happened to be scrolling down when you tapped, is a trap —
 * the only way back would be to scroll up on a screen you have not read yet.
 */
export function Dock({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const lastY = useRef(0);

  // Always re-show the dock when the route changes. Arriving on a new screen with the
  // navigation hidden -- because you happened to be scrolling down when you tapped -- is a
  // trap: the only way back would be to scroll up on a screen you have not read yet.
  //
  // Adjusted during render rather than in an effect (React's "you might not need an effect"
  // pattern for reacting to a changed prop): an effect here fires a second render pass on
  // every navigation, and eslint's react-hooks/set-state-in-effect rightly rejects it.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setHidden(false);
  }

  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY.current;
      // Ignore jitter and the rubber-band overscroll at the very top.
      if (Math.abs(delta) < 6 || y < 24) {
        if (y < 24) setHidden(false);
        lastY.current = y;
        return;
      }
      setHidden(delta > 0);
      lastY.current = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed bottom-[calc(18px+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 md:hidden",
        "flex items-center gap-1 rounded-pill border border-white/10 p-1.5",
        "transition-transform duration-[250ms] [transition-timing-function:var(--ease-spring)]",
        hidden && "translate-y-[calc(100%+32px)]",
      )}
      style={{
        backgroundColor: "rgba(28, 29, 34, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "var(--shadow-dock)",
      }}
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? Home;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex size-12 flex-col items-center justify-center gap-0.5 rounded-full",
              "transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              // `accent-strong`, not the identity `accent`: this circle is a FILL BEHIND
              // WHITE TEXT (a 9px/700 label), so it is a text-bearing surface and needs
              // 4.5:1. Raw #0A84FF measures 3.64:1 here -- axe caught it on phone, the
              // only viewport that renders the dock. Same fix, same reason, as the
              // primary button.
              // Inactive is 60% white, not the spec's 50%. The dock is translucent, so its
              // real surface differs per theme -- rgba(28,29,34,.85) composites to #3D3D42
              // over the light page and #1A1B1F over the dark one -- and at 50% the label
              // measures 4.03:1 against the lighter of the two, at 9px. 60% gives 5.06:1
              // light / 6.90:1 dark and stays clearly quieter than the active label.
              active ? "bg-accent-strong text-white" : "text-white/60",
            )}
          >
            <Icon size={active ? 18 : 17} aria-hidden="true" strokeWidth={2.2} />
            <span className="text-[9px] font-bold leading-none">
              {DOCK_LABELS[item.href] ?? item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
