import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardGreeting, firstNameOf, greetingFor } from "@/components/dashboard/greeting";

describe("greetingFor", () => {
  it("returns Good morning for [5, 12)", () => {
    expect(greetingFor(5)).toBe("Good morning");
    expect(greetingFor(11)).toBe("Good morning");
  });

  it("returns Good afternoon for [12, 18)", () => {
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good afternoon");
  });

  it("returns Good evening for [18, 24) and [0, 5), wrapping across midnight", () => {
    expect(greetingFor(18)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good evening");
    expect(greetingFor(0)).toBe("Good evening");
    expect(greetingFor(4)).toBe("Good evening");
  });
});

describe("firstNameOf", () => {
  it("returns the first token of a multi-word name", () => {
    expect(firstNameOf("Elizabeth Garthwaite")).toBe("Elizabeth");
  });

  it("returns the whole name when there is only one token", () => {
    expect(firstNameOf("Cody")).toBe("Cody");
  });

  it("trims surrounding whitespace", () => {
    expect(firstNameOf("  Ivy  ")).toBe("Ivy");
  });
});

describe("DashboardGreeting", () => {
  it("renders exactly one h1 greeting the first name, followed by a period", () => {
    render(<DashboardGreeting firstName="Cody" hour={19} summary="Wednesday, August 26 · no events yet · dinner not planned yet" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Good evening, Cody.");
  });

  it("renders the daily summary line below the heading", () => {
    render(<DashboardGreeting firstName="Cody" hour={19} summary="Wednesday, August 26 · no events yet · dinner not planned yet" />);
    expect(
      screen.getByText("Wednesday, August 26 · no events yet · dinner not planned yet"),
    ).toBeTruthy();
  });

  it("does not truncate the name -- no `truncate` utility class on the heading", () => {
    render(<DashboardGreeting firstName="Elizabeth" hour={9} summary="x" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).not.toContain("truncate");
    expect(heading.className).toContain("break-words");
    expect(heading.className).toContain("text-balance");
  });

  it("scales the heading up on wide viewports -- carries a `lg:` type-scale utility distinct from its base size", () => {
    render(<DashboardGreeting firstName="Cody" hour={9} summary="x" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toMatch(/\blg:text-\S+/);
  });
});
