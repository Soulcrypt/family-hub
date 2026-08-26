import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hearth",
    short_name: "Hearth",
    description: "Your family, in one calm place.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    // Design-Spec §9: Hearth is dark-first and wall mode is always dark. The manifest format
    // has no light/dark pair (unlike the `viewport.themeColor` media-query array in
    // app/layout.tsx), so this uses the dark token, `--color-base` (app/globals.css).
    background_color: "#0C0D10",
    theme_color: "#0C0D10",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
