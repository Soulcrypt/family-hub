import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

const LIGHT = {
  "--color-bg": "#FBF7F1",
  "--color-surface": "#FFFFFF",
  "--color-sunken": "#F4EDE3",
  "--color-ink": "#2A2520",
  "--color-muted": "#8A7F73",
  "--color-accent": "#C4643C",
  "--color-border": "#EDE4D8",
};

const DARK = {
  "--color-bg": "#1A1614",
  "--color-surface": "#221D1A",
  "--color-sunken": "#2A2320",
  "--color-ink": "#F0E9E1",
  "--color-muted": "#A89B8E",
  "--color-accent": "#E08B5F",
  "--color-border": "#332B26",
};

/** Extract the declaration body of a top-level rule, e.g. ":root" or ".dark". */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no "${selector}" rule found in globals.css`);
  return match[1] ?? "";
}

describe("design tokens", () => {
  it("defines every light token on :root", () => {
    const root = ruleBody(":root");
    for (const [name, value] of Object.entries(LIGHT)) {
      expect(root).toContain(`${name}: ${value}`);
    }
  });

  it("redefines every token in the dark scope", () => {
    const dark = ruleBody(".dark");
    for (const [name, value] of Object.entries(DARK)) {
      expect(dark).toContain(`${name}: ${value}`);
    }
  });

  it("never leaves a token defined only in dark", () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort());
  });
});
