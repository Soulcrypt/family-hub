import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { WidgetEntrance } from "@/components/dashboard/widget-entrance";

describe("WidgetEntrance", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    sessionStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("applies the rise-in animation with a per-index stagger delay the first time this session", () => {
    const { container } = render(
      <WidgetEntrance index={2}>
        <span>widget</span>
      </WidgetEntrance>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.animation).toContain("rise-in");
    expect(el.style.animationDelay).toBe("80ms");
  });

  it("skips the animation and snaps to the settled state on a second mount this session", () => {
    render(
      <WidgetEntrance index={0}>
        <span>first</span>
      </WidgetEntrance>,
    );
    // The session flag is now set -- a second widget entrance mounting afterward (e.g. a
    // client-side back-nav re-rendering the dashboard) must not replay the entrance.
    const { container } = render(
      <WidgetEntrance index={1}>
        <span>second</span>
      </WidgetEntrance>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.animation).toBe("none");
    expect(el.style.opacity).toBe("1");
  });

  it("snaps to the settled state immediately when prefers-reduced-motion is set", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { container } = render(
      <WidgetEntrance index={0}>
        <span>widget</span>
      </WidgetEntrance>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.animation).toBe("none");
    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toBe("none");
  });
});
