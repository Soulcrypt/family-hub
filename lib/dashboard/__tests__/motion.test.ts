import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "@/lib/dashboard/motion";

describe("prefersReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns true when matchMedia reports the reduce query matches", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when matchMedia reports no match", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
  });

  it("degrades to false rather than throwing when matchMedia is unavailable", () => {
    // @ts-expect-error -- simulating an environment without matchMedia at all.
    window.matchMedia = undefined;
    expect(prefersReducedMotion()).toBe(false);
  });

  it("degrades to false rather than throwing when matchMedia itself throws", () => {
    window.matchMedia = vi.fn().mockImplementation(() => {
      throw new Error("not implemented");
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});
