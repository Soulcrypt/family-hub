import type { Metadata, Viewport } from "next";
import { Aurora } from "@/components/shell/aurora";
import {
  AmbientMotionEffect,
  AmbientMotionScript,
} from "@/components/settings/ambient-motion-effect";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

/**
 * No `next/font` imports. Design-Spec §3 is explicit — "system stack ... No webfonts." — so
 * the stack lives in `--font-sans` (app/globals.css) and nothing is fetched at runtime. This
 * replaced Fraunces + Inter, which is also why the app no longer pays two font requests before
 * first paint on a cold kitchen tablet.
 */
export const metadata: Metadata = {
  title: "Hearth",
  description: "Your family, in one calm place.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Hearth" },
};

/**
 * Matches app/globals.css's `--color-base` exactly in each scope, so the browser chrome
 * (address bar, task switcher, PWA splash) tints to whatever the page is actually painting.
 *
 * Dark is listed first and is the app's default: Hearth is dark-first (spec §1.2), and a viewer
 * with no explicit preference should get the dark chrome rather than a white flash.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0C0D10" },
    { media: "(prefers-color-scheme: light)", color: "#F5F5F7" },
  ],
  // The dock and wall mode both sit against the display edges (spec §5, §9).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before first paint, so ambient motion never flashes on for someone who turned it
            off -- the same reasoning as next-themes' own blocking theme script. */}
        <AmbientMotionScript />
      </head>
      <body>
        <ThemeProvider>
          <Aurora />
          {children}
        </ThemeProvider>
        <AmbientMotionEffect />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
