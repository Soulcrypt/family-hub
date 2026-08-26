import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountUp } from "@/components/dashboard/count-up";

describe("CountUp", () => {
  const originalMatchMedia = window.matchMedia;
  const originalRaf = window.requestAnimationFrame;
  const originalCaf = window.cancelAnimationFrame;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCaf;
    vi.restoreAllMocks();
  });

  it("renders the final value immediately when prefers-reduced-motion is set (no RAF loop)", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const raf = vi.fn();
    window.requestAnimationFrame = raf as unknown as typeof window.requestAnimationFrame;

    render(<CountUp value={74} suffix="°" />);
    expect(await screen.findByText("74°")).toBeTruthy();
    expect(raf).not.toHaveBeenCalled();
  });

  it("server-renders the final value up front (never a stuck 0 before hydration/animation)", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { container } = render(<CountUp value={42} suffix="°" />);
    expect(container.textContent).toBe("42°");
  });

  it("eventually settles on the exact final value even when animating", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      now += 500; // jump straight past the animation's duration
      cb(now);
      return 1;
    }) as unknown as typeof window.requestAnimationFrame;

    render(<CountUp value={74} suffix="°" durationMs={400} />);
    expect(await screen.findByText("74°")).toBeTruthy();
  });
});
