import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: "Family Hub",
  description: "One home for your family's meals, plans, and days.",
};

// Matches app/globals.css's --color-bg exactly (light :root / .dark) so the browser
// UI (address bar, task-switcher chrome, etc.) tints to whichever theme is actually
// rendering, instead of defaulting to white/black regardless of it.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7F1" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1614" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
