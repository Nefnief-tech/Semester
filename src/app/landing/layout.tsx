import type { Metadata } from "next";

/**
 * German-first metadata for the marketing landing — the audience is German
 * students, so the share card leads in German regardless of the in-page
 * DE/EN toggle (which is client-side and invisible to crawlers).
 */
export const metadata: Metadata = {
  title: "Semester. Der Schreibtisch fürs Schuljahr, im Web und am Handy.",
  description:
    "Stundenplan mit Live-Vertretungen, Aufgaben, Hausaufgaben, Noten und ein KI-Lernraum. Ein Design, eine Datenbank, alle Geräte. Open Source und selbst hostbar.",
  openGraph: {
    title: "Semester. Der Schreibtisch fürs Schuljahr, im Web und am Handy.",
    description:
      "Stundenplan mit Live-Vertretungen, Aufgaben, Hausaufgaben, Noten und ein KI-Lernraum. Ein Design, eine Datenbank, alle Geräte.",
    type: "website",
  },
};

export default function LandingLayout({ children }: LayoutProps<"/landing">) {
  return children;
}
