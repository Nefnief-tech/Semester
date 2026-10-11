import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import AppShell from "@/components/layout/AppShell";
import ConsentGate from "@/components/consent/CookieBanner";
import "./globals.css";

/**
 * Fonts are self-hosted from src/fonts — nothing is loaded from Google or any
 * other third party at runtime or build time (DSGVO). The CSS variables keep
 * every existing font-* class working unchanged.
 */
const fraunces = localFont({
  src: [
    { path: "../fonts/fraunces-latin.woff2", style: "normal", weight: "100 900" },
    { path: "../fonts/fraunces-italic-latin.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const instrument = localFont({
  src: [
    { path: "../fonts/instrument-latin.woff2", style: "normal", weight: "400 700" },
    { path: "../fonts/instrument-italic-latin.woff2", style: "italic", weight: "400 700" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

const plex = localFont({
  src: [
    { path: "../fonts/plex-400.woff2", style: "normal", weight: "400" },
    { path: "../fonts/plex-500.woff2", style: "normal", weight: "500" },
    { path: "../fonts/plex-600.woff2", style: "normal", weight: "600" },
  ],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Semester · your study desk",
  description:
    "All-in-one study app: tasks with due dates, a weighted grade calculator and a calendar that keeps it all together.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2ea" },
    { media: "(prefers-color-scheme: dark)", color: "#17150f" },
  ],
};

/** applies the stored (or system) theme before first paint to avoid a flash */
const themeInit = `(function(){try{var s=localStorage.getItem("semester.theme");if(s==="dark"||(!s&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${instrument.variable} ${plex.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* consent gate: until the banner is answered nothing renders, runs
            or persists — the service worker registers only after a decision */}
        <ConsentGate>
          <AppShell>{children}</AppShell>
        </ConsentGate>
      </body>
    </html>
  );
}
