"use client";

import { useEffect } from "react";
import { readAmbientMotionPreference } from "@/lib/settings/ambient-motion";

const STYLE_ID = "hearth-ambient-motion-override";
const ATTRIBUTE = "data-ambient-motion";

/** The actual CSS that disables ambient motion + staggered entrances when the preference is
 * off — mirrors app/globals.css's own `prefers-reduced-motion: reduce` kill-switch (kept as an
 * INDEPENDENT, additive mechanism: this attribute selector never overrides a genuine OS-level
 * reduced-motion request, it only adds a second way to reach the same collapsed-to-0.01ms
 * state). Injected as a real `<style>` element rather than relying on a Tailwind utility, since
 * this file cannot edit app/globals.css (out of this task's scope — see components/shell/**'s
 * "do not touch" boundary) and a JS-set `data-*` attribute has no effect without a stylesheet
 * rule that reads it. */
const OVERRIDE_CSS = `
html[${ATTRIBUTE}="off"] *,
html[${ATTRIBUTE}="off"] *::before,
html[${ATTRIBUTE}="off"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
`;

function applyPreference(enabled: boolean): void {
  document.documentElement.setAttribute(ATTRIBUTE, enabled ? "on" : "off");

  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = OVERRIDE_CSS;
  document.head.appendChild(style);
}

/**
 * Applies the "Ambient animations" preference (Settings > Appearance) to whatever page it is
 * mounted on — no visible output, just an effect. Mounted once per top-level route this task
 * owns (app/(app)/settings/layout.tsx, app/(app)/family/layout.tsx, app/switch/page.tsx): the
 * attribute it sets on `<html>` and the stylesheet it injects into `<head>` both persist across
 * client-side navigation for the rest of the session (React does not unmount `<html>`/`<head>`
 * on a route change), so once a visitor has passed through any of this task's screens the
 * preference keeps holding even after they navigate elsewhere in the app.
 *
 * Reads via `readAmbientMotionPreference()` (lib/settings/ambient-motion.ts) on mount AND
 * re-reads on the `storage` event, so a toggle flipped in one tab (or on the Appearance pane,
 * whose own component also calls `applyPreference` synchronously on change — see
 * `AmbientMotionToggle`) takes effect without a reload.
 */
export function AmbientMotionEffect() {
  useEffect(() => {
    applyPreference(readAmbientMotionPreference());

    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === "hearth:ambient-motion") {
        applyPreference(readAmbientMotionPreference());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

/** Exported so `AmbientMotionToggle` (the control that actually flips the preference) can apply
 * it to the CURRENT tab immediately — the `storage` event above only fires in OTHER tabs/
 * windows, never the one that made the change. */
export function applyAmbientMotionPreference(enabled: boolean): void {
  applyPreference(enabled);
}
