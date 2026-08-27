import { beforeEach, describe, expect, it } from "vitest";
import {
  AMBIENT_MOTION_STORAGE_KEY,
  readAmbientMotionPreference,
  writeAmbientMotionPreference,
} from "@/lib/settings/ambient-motion";

/**
 * jsdom's `window` is served from an opaque `about:blank`-style origin under this project's
 * vitest config (no `environmentOptions.jsdom.url` is set), and the Web Storage spec disables
 * `localStorage` entirely for an opaque origin — `window.localStorage` comes back `undefined`
 * here, not a working (if empty) store. A tiny in-memory stand-in, installed once for this
 * file, is closer to a real browser's behavior than the test environment's default and keeps
 * `lib/settings/ambient-motion.ts` itself written the way production code should read it
 * (`window.localStorage`), rather than forcing it to accept an injectable store no other
 * per-device preference in this codebase uses (next-themes reads `window.localStorage`
 * directly the same way).
 */
function installFakeLocalStorage(): void {
  const store = new Map<string, string>();
  const fakeStorage: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", { value: fakeStorage, configurable: true });
}

describe("ambient motion preference", () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it("defaults to enabled when nothing has been stored yet", () => {
    expect(readAmbientMotionPreference()).toBe(true);
  });

  it("persists an explicit off choice", () => {
    writeAmbientMotionPreference(false);
    expect(readAmbientMotionPreference()).toBe(false);
    expect(window.localStorage.getItem(AMBIENT_MOTION_STORAGE_KEY)).toBe("off");
  });

  it("persists an explicit on choice, overwriting a previous off", () => {
    writeAmbientMotionPreference(false);
    writeAmbientMotionPreference(true);
    expect(readAmbientMotionPreference()).toBe(true);
    expect(window.localStorage.getItem(AMBIENT_MOTION_STORAGE_KEY)).toBe("on");
  });

  it("degrades to the default rather than throwing when storage holds a malformed value", () => {
    window.localStorage.setItem(AMBIENT_MOTION_STORAGE_KEY, "not-a-real-value");
    expect(readAmbientMotionPreference()).toBe(true);
  });
});
