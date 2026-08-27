"use client";

import { useEffect } from "react";
import {
  AMBIENT_MOTION_STORAGE_KEY,
  readAmbientMotionPreference,
} from "@/lib/settings/ambient-motion";

const ATTRIBUTE = "data-ambient-motion";

/**
 * Runs BEFORE first paint, from the root layout, so ambient motion never starts and then stops.
 *
 * This is the same trick `next-themes` uses for the theme class, and for the same reason: the
 * preference lives in `localStorage`, which the server cannot read, so without a blocking
 * script the aurora would drift and the widgets would stagger in for one frame before an
 * effect could switch them off. Someone who has turned ambient motion off is precisely the
 * person most bothered by seeing it flash.
 *
 * Reads inline rather than importing the helper, because this string executes as raw JS in the
 * document head before any bundle has loaded. The storage key is interpolated from the single
 * source of truth so the two cannot drift apart.
 */
export function AmbientMotionScript() {
  const script = `
try {
  var v = window.localStorage.getItem(${JSON.stringify(AMBIENT_MOTION_STORAGE_KEY)});
  document.documentElement.setAttribute(${JSON.stringify(ATTRIBUTE)}, v === "off" ? "off" : "on");
} catch (e) {
  document.documentElement.setAttribute(${JSON.stringify(ATTRIBUTE)}, "on");
}`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

/**
 * Keeps the attribute in sync after hydration — for a toggle flipped in ANOTHER tab or window.
 * The tab that made the change applies it synchronously itself (`applyAmbientMotionPreference`
 * below), because the `storage` event deliberately never fires in the originating tab.
 *
 * The CSS that reads this attribute lives in `app/globals.css`, next to the
 * `prefers-reduced-motion` rule it mirrors, rather than being injected at runtime: they are the
 * same mechanism reached two ways, and keeping them apart is how they drift.
 */
export function AmbientMotionEffect() {
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === AMBIENT_MOTION_STORAGE_KEY) {
        applyAmbientMotionPreference(readAmbientMotionPreference());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

/** Exported so the toggle can apply its own change to the CURRENT tab immediately — the
 * `storage` event only fires in other tabs, never the one that made the change. */
export function applyAmbientMotionPreference(enabled: boolean): void {
  document.documentElement.setAttribute(ATTRIBUTE, enabled ? "on" : "off");
}
