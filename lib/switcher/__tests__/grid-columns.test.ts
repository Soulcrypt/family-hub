import { describe, expect, it } from "vitest";
import { columnsForMemberCount } from "@/lib/switcher/grid-columns";

/**
 * The profile switcher's tile grid used to be a hardcoded `grid-cols-2 sm:grid-cols-3`, which
 * leaves a single orphaned tile on the third row at 4 members (3 + 1) — the ragged layout this
 * task's brief calls out by name. `columnsForMemberCount` picks a column count that keeps every
 * row as even as possible for 2–6 members (the realistic household size range), rather than a
 * fixed breakpoint that happens to look fine at some counts and not others.
 */
describe("columnsForMemberCount", () => {
  it("never leaves a lone tile on its own row for 2-6 members", () => {
    for (let n = 2; n <= 6; n++) {
      const columns = columnsForMemberCount(n);
      const remainder = n % columns;
      const lastRowSize = remainder === 0 ? columns : remainder;
      expect(lastRowSize, `n=${n}, columns=${columns}`).toBeGreaterThan(1);
    }
  });

  it("uses 2 columns for 2 members", () => {
    expect(columnsForMemberCount(2)).toBe(2);
  });

  it("uses 3 columns for 3 members", () => {
    expect(columnsForMemberCount(3)).toBe(3);
  });

  it("uses 2 columns (a balanced 2x2) for 4 members, not 3", () => {
    expect(columnsForMemberCount(4)).toBe(2);
  });

  it("uses 3 columns for 5 members (3 + 2, no orphan)", () => {
    expect(columnsForMemberCount(5)).toBe(3);
  });

  it("uses 3 columns for 6 members (two even rows of 3)", () => {
    expect(columnsForMemberCount(6)).toBe(3);
  });

  it("falls back to 3 columns for a single member or a larger household", () => {
    expect(columnsForMemberCount(1)).toBe(1);
    expect(columnsForMemberCount(7)).toBe(3);
  });
});
