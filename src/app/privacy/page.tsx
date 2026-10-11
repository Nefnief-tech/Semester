import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import ConsentReset from "@/components/consent/ConsentReset";

export const metadata: Metadata = {
  title: "Datenschutz · Semester",
  description:
    "Datenschutz bei Semester: lokale Speicherung, keine Tracker, keine Google-Fonts, externe Dienste nur nach Zustimmung.",
};

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Das Kurze",
    body: [
      "Semester arbeitet lokal. Deine Aufgaben, Noten, Hausaufgaben, Bücher und Einstellungen liegen in deinem Browser (localStorage und IndexedDB) auf diesem Gerät — nicht auf unseren Servern, nicht bei Google, nicht bei Werbenetzern.",
      "Es gibt keine Tracker, keine Analyse-Tools, keine Werbung und keine Cookies von Drittanbietern.",
    ],
  },
  {
    title: "Was auf deinem Gerät gespeichert wird",
    body: [
      "Notwendig (für den Betrieb, ohne das läuft nichts): deine Aufgaben, Hausaufgaben, Noten, Fächer, Termine, Bücher und Lesepositionen, der Stundenplan, Themes und Spracheinstellung sowie ob du dieses Banner beantwortet hast. Das Zulassen dieser Speicherung ist technisch erforderlich.",
      "Nach Zustimmung: externe Dienste wie Spotify — erst dann werden Daten an Dritte übermittelt, und nur so weit wie der Dienst sie braucht.",
    ],
  },
  {
    title: "Keine Google-Fonts, keine externen Skripte",
    body: [
      "Alle Schriften (Fraunces, Instrument Sans, IBM Plex Mono) liegen auf unseren eigenen Servern. Es gibt keine Verbindungen zu fonts.googleapis.com, fonts.gstatic.com oder anderen CDN-Anbietern.",
    ],
  },
  {
    title: "Sync und Schulportal — nur wenn du es nutzt",
    body: [
      "Wenn du dich anmeldest, liegen die synchronisierten Daten in deiner eigenen Appwrite-Instanz (selbst gehostet oder Appwrite Cloud nach deiner Wahl) — nicht bei uns.",
      "Die Zugangsdaten für dein Schulportal bleiben auf diesem Gerät und werden ausschließlich an deinen eigenen Server gesendet, wenn du den Vertretungsplan abrufst.",
    ],
  },
  {
    title: "Externe Dienste (Zustimmung)",
    body: [
      "Derzeit bindet Semester keine externen Dienste ein. Sobald eine Integration dazukommt (z.B. Spotify), fragen wir vorher um Zustimmung — du kannst sie in den Cookie-Einstellungen jederzeit widerrufen.",
    ],
  },
  {
    title: "Deine Rechte",
    body: [
      "Weil Semester lokal arbeitet, bleiben die Datenhoheit komplett bei dir: Über „Alle Daten löschen“ im Konto oder das Löschen der Browser-Daten entfernst du alles sofort und vollständig. Für synchronisierte Daten gilt die Datenschutzerklärung deiner eigenen Appwrite-Instanz.",
      "Bei Fragen: Issue auf GitHub.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="flex items-center gap-3 font-display text-4xl font-semibold tracking-tight">
        Datenschutz
        <ShieldCheck className="size-5 text-accent" />
      </h1>
      <p className="mt-1 font-mono text-xs tracking-wide text-ink-soft">
        kurz, deutsch und ohne Kleingedrucktes · Stand: Oktober 2026
      </p>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-lg font-semibold tracking-tight">{section.title}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section className="rounded-2xl border border-line bg-card px-5 py-4">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Zustimmung ändern
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            Damit der Banner nochmal fragt.
          </p>
          <div className="mt-3">
            <ConsentReset />
          </div>
        </section>

        <p>
          <Link href="/" className="font-mono text-xs text-accent underline decoration-line transition-colors hover:text-ink">
            ← zurück zu Semester
          </Link>
        </p>
      </div>
    </div>
  );
}
