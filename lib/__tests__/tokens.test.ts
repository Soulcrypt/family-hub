import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

/**
 * These tests do not check that tokens are spelled correctly — that is what a typo looks like,
 * not what a design-system bug looks like. Two real bugs have shipped from this file:
 *
 *  1. `--color-muted` was mapped to a sunken SURFACE while `text-muted` read it as TEXT,
 *     producing 1.09:1 body copy. Every token was present and correctly spelled.
 *  2. The Hearth spec asks for white 13/700 on `#0A84FF`, which measures 3.65:1 — a genuine
 *     AA failure that the spec's own §10 ("all text >= 4.5:1") contradicts.
 *
 * So this suite composites the tokens the way a browser will and asserts the resulting
 * CONTRAST. A token can be renamed freely; it cannot become illegible without failing here.
 */

/** Extract the declaration body of a top-level rule, e.g. ":root" or ".light". */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`no "${selector}" rule found in globals.css`);
  return match[1] ?? "";
}

function tokenValue(scope: string, name: string): string {
  const body = ruleBody(scope);
  const match = body.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`"${name}" is not defined in "${scope}"`);
  return (match[1] ?? "").trim();
}

type Rgb = [number, number, number];

function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1] as string;
    return {
      rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)],
      alpha: 1,
    };
  }
  const rgba = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = (rgba[1] as string).split(",").map((p) => Number.parseFloat(p.trim()));
    const [r, g, b, a] = parts;
    if (r === undefined || g === undefined || b === undefined) throw new Error(`bad rgb: ${value}`);
    return { rgb: [r, g, b], alpha: a ?? 1 };
  }
  throw new Error(`unparseable color: ${value}`);
}

/** Composite `fg` over `bg` in sRGB space — the same maths the compositor does. */
function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => (fg[i] as number) * alpha + (bg[i] as number) * (1 - alpha)) as Rgb;
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const channel = c / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The effective background a card's text actually sits on: base, then the brightest patch of
 * aurora, then the glass fill. Using the brightest aurora patch is deliberate — it is the
 * worst case for contrast, and it is exactly the region the dashboard greeting sits over.
 */
function glassOverAurora(scope: string): Rgb {
  const base = parseColor(tokenValue(scope, "--color-base"));
  const aurora = parseColor(tokenValue(scope, "--aurora-a"));
  const glass = parseColor(tokenValue(scope, "--color-glass"));
  const withAurora = over(aurora.rgb, aurora.alpha, base.rgb);
  return over(glass.rgb, glass.alpha, withAurora);
}

function textContrast(scope: string, tokenName: string): number {
  const surface = glassOverAurora(scope);
  const token = parseColor(tokenValue(scope, tokenName));
  return contrast(over(token.rgb, token.alpha, surface), surface);
}

describe("Hearth tokens — dark (the default scope)", () => {
  const scope = ":root";

  it("paints dark by default, so the first pre-hydration frame is not a white flash", () => {
    expect(tokenValue(scope, "--color-base")).toBe("#0C0D10");
    expect(ruleBody(scope)).toContain("color-scheme: dark");
  });

  it("clears AA for primary and secondary text on glass over the brightest aurora", () => {
    expect(textContrast(scope, "--color-text")).toBeGreaterThanOrEqual(4.5);
    expect(textContrast(scope, "--color-text-secondary")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps tertiary text above the 3:1 non-text floor, which is all it is licensed for", () => {
    // Spec §10 reserves tertiary for non-essential meta. It genuinely cannot carry essential
    // text — asserting the real number here is what stops someone "reusing" it for a label.
    const ratio = textContrast(scope, "--color-text-tertiary");
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThan(4.5);
  });

  it("never lets the raw accent be used as text, and supplies one that can", () => {
    // #0A84FF is the identity colour: correct for borders, rings and indicators, where
    // WCAG 1.4.11 asks 3:1. It does not reach 4.5:1 as text, which is why accent-text exists.
    expect(textContrast(scope, "--color-accent")).toBeGreaterThanOrEqual(3);
    expect(textContrast(scope, "--color-accent")).toBeLessThan(4.5);
    expect(textContrast(scope, "--color-accent-text")).toBeGreaterThanOrEqual(4.5);
  });

  it("puts white on a primary-button fill that white can actually sit on", () => {
    // The regression this exists for: the spec asks for white 13/700 on #0A84FF (3.65:1).
    const fill = parseColor(tokenValue(scope, "--color-accent-strong"));
    const onAccent = parseColor(tokenValue(scope, "--color-on-accent"));
    expect(contrast(onAccent.rgb, fill.rgb)).toBeGreaterThanOrEqual(4.5);
  });

  it("supplies a danger colour that clears AA as text, separate from the border fill", () => {
    expect(textContrast(scope, "--color-danger")).toBeGreaterThanOrEqual(3);
    expect(textContrast(scope, "--color-danger-text")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps success, warning and star legible as text on glass", () => {
    for (const token of ["--color-success", "--color-warning", "--color-star"]) {
      expect(textContrast(scope, token), token).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("Hearth tokens — light", () => {
  const scope = ".light";

  it("clears AA for primary and secondary text", () => {
    expect(textContrast(scope, "--color-text")).toBeGreaterThanOrEqual(4.5);
    expect(textContrast(scope, "--color-text-secondary")).toBeGreaterThanOrEqual(4.5);
  });

  it("clears AA for accent, danger and warning text", () => {
    for (const token of ["--color-accent-text", "--color-danger-text", "--color-warning"]) {
      expect(textContrast(scope, token), token).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("puts white on a primary-button fill that white can actually sit on", () => {
    const fill = parseColor(tokenValue(scope, "--color-accent-strong"));
    const onAccent = parseColor(tokenValue(scope, "--color-on-accent"));
    expect(contrast(onAccent.rgb, fill.rgb)).toBeGreaterThanOrEqual(4.5);
  });

  it("redefines every colour token that dark defines, so none is dark-only", () => {
    const darkBody = ruleBody(":root");
    const lightBody = ruleBody(".light");
    const colorTokens = [...darkBody.matchAll(/(--color-[a-z-]+):/g)].map((m) => m[1] as string);
    // Tokens whose dark value is deliberately shared (shape, motion, accent identity).
    const shared = new Set([
      "--color-accent",
      "--color-on-accent",
      "--color-accent-ring",
      "--color-accent-strong",
    ]);
    const missing = colorTokens.filter((t) => !shared.has(t) && !lightBody.includes(`${t}:`));
    expect(missing).toEqual([]);
  });
});

describe("no webfonts", () => {
  it("uses the system stack only, per spec §3", () => {
    expect(css).toContain("-apple-system, BlinkMacSystemFont");
    expect(css).not.toContain("--font-fraunces");
    expect(css).not.toContain("--font-inter");
  });
});
