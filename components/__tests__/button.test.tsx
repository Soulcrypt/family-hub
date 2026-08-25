import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Add member</Button>);
    expect(screen.getByRole("button", { name: "Add member" })).toBeDefined();
  });

  it("applies the 44px minimum tap target at every size", () => {
    const { container } = render(
      <>
        <Button size="default">a</Button>
        <Button size="sm">b</Button>
        <Button size="icon">c</Button>
      </>,
    );
    for (const el of container.querySelectorAll("button")) {
      expect(el.className).toContain("min-h-[44px]");
    }
  });

  it("uses the AA-legible accent-strong fill for the default variant", () => {
    render(<Button>Add member</Button>);
    const className = screen.getByRole("button", { name: "Add member" }).className;
    expect(className).toContain("bg-accent-strong");
    expect(className).toContain("text-on-accent");
  });
});
