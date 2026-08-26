import { describe, expect, it } from "vitest";
import { MEMBER_COLOR_SWATCHES } from "@/lib/constants/member-color-swatches";

// Mirrors (does not import -- that helper is private to that module) the exact WCAG
// relative-luminance / contrast-ratio algorithm components/family/member-avatar.tsx's
// `foregroundFor()` uses to pick between its fixed ink (#2A2520) and white foregrounds. See
// this repo's design-review fix: the preset swatch palette replacing the raw
// `<input type="color">` well must clear 4.5:1 against whichever of those two foregrounds
// that algorithm would actually pick for each swatch -- not against an assumed white or ink.
const INK = "#2A2520";
const WHITE_LUMINANCE = 1;

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`not a #RRGGBB hex color: ${hex}`);
  const [, rHex, gHex, bHex] = match;
  const [r, g, b] = [rHex, gHex, bHex].map((component) => {
    const channel = parseInt(component as string, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const INK_LUMINANCE = relativeLuminance(INK);

function bestForegroundRatio(fill: string): number {
  const fillLuminance = relativeLuminance(fill);
  const withWhite = contrastRatio(fillLuminance, WHITE_LUMINANCE);
  const withInk = contrastRatio(fillLuminance, INK_LUMINANCE);
  return Math.max(withWhite, withInk);
}

describe("member color swatch palette", () => {
  // Pinned to the exact set in Design-Spec §2.2 rather than a minimum count. The spec assigns
  // the first three to the household (Cody / Elizabeth / Ivy) and offers the last three to
  // future members; a count assertion would let a well-meaning edit swap in an off-spec hue
  // and still pass.
  it("is exactly the palette Design-Spec §2.2 defines, in order", () => {
    expect(MEMBER_COLOR_SWATCHES.map((s) => s.hex)).toEqual([
      "#B6E6B0",
      "#F3B3D4",
      "#FFD08A",
      "#9AD0FF",
      "#C9B8F5",
      "#F5D48A",
    ]);
  });

  it("every swatch is a distinct #RRGGBB hex value", () => {
    const hexes = MEMBER_COLOR_SWATCHES.map((s) => s.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
    for (const hex of hexes) expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("every swatch clears 4.5:1 against whichever foreground member-avatar's foregroundFor() would pick", () => {
    for (const swatch of MEMBER_COLOR_SWATCHES) {
      const ratio = bestForegroundRatio(swatch.hex);
      expect(ratio, `${swatch.name} (${swatch.hex}) only reaches ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("excludes the schema's own default #C4643C, which only reaches ~4.0:1", () => {
    const hexes = MEMBER_COLOR_SWATCHES.map((s) => s.hex.toUpperCase());
    expect(hexes).not.toContain("#C4643C");
  });
});
