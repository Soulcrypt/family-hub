import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardGreeting } from "@/components/dashboard/greeting";

/**
 * SP1 Foundation design review: a wall-mounted kitchen tablet is the primary surface, glanced
 * at from ~1.5m away, so the greeting needs (a) its own larger type scale on wide viewports
 * (today it is identical at 390px and 1280px) and (b) to actually WRAP a long household name
 * instead of clipping it -- `truncate` (white-space: nowrap) sat alongside `break-words` and
 * won, rendering "Good afternoon, The Ri..." at 390px (measured: scrollWidth 473 vs
 * clientWidth 342). See this task's brief.
 */
describe("DashboardGreeting", () => {
  it("does not truncate the household name -- no `truncate` utility class on the heading", () => {
    render(
      <DashboardGreeting
        householdName="The Riveras"
        hour={14}
        dateLabel="Tuesday, August 25"
      />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).not.toContain("truncate");
  });

  it("still wraps a long household name onto multiple lines rather than overflowing", () => {
    render(
      <DashboardGreeting
        householdName="The Riveras"
        hour={14}
        dateLabel="Tuesday, August 25"
      />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("break-words");
    expect(heading.className).toContain("min-w-0");
  });

  it("renders the full household name even when it is very long", () => {
    const longName = "The Extraordinarily Long Household Name That Goes On And On Riveras";
    render(<DashboardGreeting householdName={longName} hour={14} dateLabel="Tuesday, August 25" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(longName);
  });

  it("scales the heading up on wide viewports -- carries a `lg:` type-scale utility distinct from its base size", () => {
    render(
      <DashboardGreeting
        householdName="The Riveras"
        hour={14}
        dateLabel="Tuesday, August 25"
      />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toMatch(/\blg:text-\S+/);
  });

  it("scales the date line up on wide viewports too", () => {
    render(
      <DashboardGreeting
        householdName="The Riveras"
        hour={14}
        dateLabel="Tuesday, August 25"
      />,
    );
    const date = screen.getByText("Tuesday, August 25");
    expect(date.className).toMatch(/\blg:text-\S+/);
  });
});
