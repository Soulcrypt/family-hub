#!/usr/bin/env node
/**
 * Regenerates every raster icon from `assets/brand/hearth-mark.svg`.
 *
 * Run with: `node scripts/build-icons.mjs` (needs ImageMagick's `magick` on PATH).
 *
 * This exists as a checked-in script rather than a one-off command because the icon set has
 * three constraints that are easy to get wrong and invisible when you do — all three have been
 * shipped broken in this repo at least once:
 *
 *  1. **Every raster must be fully opaque.** A transparent `purpose: "any"` icon disappears on
 *     a launcher whose background happens to match it. The accent plate is flattened in, and
 *     the alpha channel removed entirely rather than merely filled.
 *
 *  2. **The maskable safe zone is a CIRCLE of 80% diameter, not a square.** A mark that fits
 *     the 80% *width* can still have its corners clipped, because the corners of a square sit
 *     further from centre than its edges. What matters is the mark's HALF-DIAGONAL against a
 *     204.8px radius on a 512 canvas — this script asserts it rather than trusting the eye.
 *
 *  3. **`app/favicon.ico` and `app/apple-icon.png` are Next.js file conventions.** Writing a
 *     `public/favicon.ico` alongside them is a build error, not an override.
 *
 * The plate is `#0A84FF`, the design system's single accent — deliberately NOT the source
 * artwork's own `#0167FD`. Design-Spec §2 allows exactly one accent, and the two blues read as
 * a mismatch side by side. The shape is the designer's; only the hue is unified.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ACCENT = "#0A84FF";
const MARK = path.join(root, "assets/brand/hearth-mark.svg");
const MARKS_ONLY = path.join(root, "assets/brand/hearth-marks-only.svg");

function magick(args) {
  execFileSync("magick", args, { stdio: ["ignore", "pipe", "inherit"] });
}

/** Full-bleed accent plate with the mark centred at `markPx`, flattened opaque. */
function build(out, canvas, markPx) {
  mkdirSync(path.dirname(out), { recursive: true });
  magick([
    "-background", "none", MARKS_ONLY,
    "-resize", `${markPx}x${markPx}`,
    "-background", ACCENT, "-gravity", "center", "-extent", `${canvas}x${canvas}`,
    "-alpha", "remove", "-alpha", "off",
    out,
  ]);
}

function markExtent(file) {
  const out = execFileSync("magick", [
    file, "-bordercolor", ACCENT, "-border", "1", "-trim", "-format", "%w %h", "info:",
  ]).toString().trim().split(/\s+/).map(Number);
  return { width: out[0], height: out[1] };
}

// --- "any" icons, apple touch icon, favicon -------------------------------------------------
// 62% keeps roughly the proportion the mark has inside the artwork's own rounded square.
build(path.join(root, "public/icons/icon-192.png"), 192, Math.round(192 * 0.62));
build(path.join(root, "public/icons/icon-512.png"), 512, Math.round(512 * 0.62));
build(path.join(root, "app/apple-icon.png"), 180, Math.round(180 * 0.62));

const faviconSrc = path.join(root, "public/icons/.favicon-src.png");
build(faviconSrc, 512, Math.round(512 * 0.66));
magick([faviconSrc, "-define", "icon:auto-resize=16,32,48", path.join(root, "app/favicon.ico")]);
rmSync(faviconSrc);

// --- maskable --------------------------------------------------------------------------------
const maskable = path.join(root, "public/icons/maskable-512.png");
build(maskable, 512, 340);

const { width, height } = markExtent(maskable);
const halfDiagonal = Math.hypot(width / 2, height / 2);
const SAFE_RADIUS = 0.4 * 512;
if (halfDiagonal > SAFE_RADIUS) {
  throw new Error(
    `maskable mark escapes the safe circle: half-diagonal ${halfDiagonal.toFixed(1)}px > ${SAFE_RADIUS}px. ` +
      "Reduce the mark size in this script until it fits.",
  );
}

console.log(
  `icons rebuilt — maskable mark ${width}x${height}, ` +
    `half-diagonal ${halfDiagonal.toFixed(1)}px within the ${SAFE_RADIUS}px safe radius`,
);
