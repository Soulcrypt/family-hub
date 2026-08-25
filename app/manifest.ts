import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Hub",
    short_name: "Family Hub",
    description: "One home for your family’s meals, plans, and days.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7F1",
    theme_color: "#FBF7F1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
