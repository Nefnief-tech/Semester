import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import ConsentReset from "@/components/consent/ConsentReset";

export const metadata: Metadata = {
  title: "Datenschutz · Semester",
  description:
    "Datenschutz bei Semester: lokale Speicherung, keine Tracker, keine Google-Fonts, Sync nur nach Anmeldung, externe Dienste nur nach Zustimmung.",
};

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Das Kurze",
    body: [
      "Semester arbeitet in erster Linie lokal: Deine Aufgaben, Noten, Hausaufgaben, Bücher und Einstellungen liegen standardmäßig in deinem Browser (localStorage und IndexedDB) auf diesem Gerät — nicht bei Google, nicht bei Werbenetzern.",
      "Es gibt keine Tracker, keine Analyse-Tools, keine Werbung und keine Cookies von Drittanbietern. Was darüber hinaus passiert, steht weiter unten — und zwar so, wie es wirklich ist.",
    ],
  },
  {
    title: "Ohne Anmeldung: alles bleibt auf deinem Gerät",
    body: [
      "Nicht angemeldet speichert Semester ausschließlich auf diesem Gerät: Aufgaben, Hausaufgaben, Noten, Fächer, Termine, der Stundenplan, EPUB-Bücher samt Leseposition, Markierungen und Kommentare, Themes und Sprache. Diese Speicherung ist technisch notwendig — ohne sie funktioniert die App nicht.",
      "Zugangsdaten für dein Schulportal bleiben ebenfalls immer auf diesem Gerät.",
    ],
  },
  {
    title: "Mit Anmeldung: Synchronisierung über Appwrite Cloud (EU)",
    body: [
      "Sobald du dich anmeldest, wird dein Konto bei Appwrite Cloud angelegt — betrieben von Appwrite in dessen Rechenzentrum Frankfurt am Main (EU). Deine E-Mail-Adresse und dein Passwort (gehasht, bei Appwrite) liegen dort, Zwei-Faktor läuft per E-Mail.",
      "Gleichzeitig schaltet du die Synchronisierung frei: Fächer, Aufgaben, Hausaufgaben, Noten, Termine, dein Stundenplan und die abgerufenen Vertretungsplan-Einträge werden als einzelne Datenzeilen zwischen deinen Geräten und Appwrite Cloud synchronisiert. Die Push-Benachrichtigungen (Tages- und Wochenrückblick, Hausaufgaben-Erinnerungen) entstehen dadurch, dass ein Serverprozess auf dem Semester-Server diese Datenzeilen liest und Appwrite Messaging anweist, dir eine Nachricht zu schicken.",
      "Nicht synchronisiert werden: deine EPUB-Dateien, Lesepositionen, Markierungen und Kommentare (Bibliothek), deine Schulportal-Zugangsdaten, Archive alter Schuljahre und deine Cookie-Entscheidung. Das bleibt auf dem Gerät.",
    ],
  },
  {
    title: "KI-Lernraum: Dokumente und Chat",
    body: [
      "Lädst du Material in den Lernraum, wird der Text serverseitig aus der Datei extrahiert und auf dem Semester-Server gespeichert (in einem eigenen Datenordner, deinem Konto zugeordnet) — das ist nötig, damit Antworten und Lernkarten auf deinem Material basieren.",
      "Stellst du eine Frage, gehen deine Nachricht und die von dir ausgewählten Dokumentausschnitte vom Semester-Server an den konfigurierten KI-Anbieter weiter (je nach Konfiguration DeepSeek, Z.AI/GLM oder OpenAI) und von dort kommt die Antwort. Für diesen Schritt brauchst du Zugang zum KI-Team; ohne Anmeldung oder ohne Freischaltung werden keine KI-Anfragen ausgeführt.",
    ],
  },
  {
    title: "Keine Google-Fonts, keine externen Skripte",
    body: [
      "Alle Schriften (Fraunces, Instrument Sans, IBM Plex Mono) liegen auf unseren eigenen Servern. Es gibt keine Verbindungen zu fonts.googleapis.com, fonts.gstatic.com oder anderen CDN-Anbietern — weder beim Besuch noch beim Laden der Seite.",
    ],
  },
  {
    title: "Schulportal",
    body: [
      "Die Zugangsdaten für dein Schulportal (z.B. Eltern-Portal) bleiben auf diesem Gerät. Beim Abrufen des Vertretungsplans sendet dein eigener Semester-Server diese Daten an das Schulportal — an niemanden sonst. Die gerenderten Vertretungen selbst werden (nach Anmeldung) über Appwrite synchronisiert, damit sie auf allen Geräten erscheinen.",
    ],
  },
  {
    title: "Externe Dienste (Zustimmung)",
    body: [
      "Weitere externe Dienste (z.B. Spotify) bindet Semester erst nach deiner ausdrücklichen Zustimmung im Banner ein — und nur so weit, wie der jeweilige Dienst es braucht. Die Zustimmung kannst du über „Cookie-Einstellungen ändern“ weiter unten jederzeit widerrufen.",
    ],
  },
  {
    title: "Deine Rechte und wie du alles loswirst",
    body: [
      "Lokale Daten: „Alle Daten löschen“ im Konto entfernt Aufgaben, Noten, Fächer, Termine und Hausaufgaben sofort. Die Bücher-Bibliothek löschst du einzelnd in „Lesen“, EPUB-Dateien liegen in der Browser-Datenbank dieses Geräts und gehen mit weg, wenn du die Browser-Daten löschst.",
      "Synchronisierte Daten und Konto: Eine Konto-Löschung läuft über den Betreiber dieser Instanz — stell dazu eine Anfrage über GitHub Issues. Da die synchronisierten Daten in der EU (Appwrite Cloud, Frankfurt) liegen, gelten zusätzlich die Datenschutzangaben von Appwrite.",
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
            Damit der Banner nochmal fragt, ob externe Dienste geladen werden dürfen.
          </p>
          <div className="mt-3">
            <ConsentReset />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-card px-5 py-4">
          <h2 className="font-display text-base font-semibold tracking-tight">Verantwortlich</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            Betreiber dieser Semester-Instanz: Nefnief-tech (Fabian). Fragen, Auskunfts- und
            Löschwünsche am schnellsten über{" "}
            <a
              href="https://github.com/Nefnief-tech/Semester/issues"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line transition-colors hover:text-ink"
            >
              GitHub Issues
            </a>
            .
          </p>
        </section>

        <p>
          <Link
            href="/"
            className="font-mono text-xs text-accent underline decoration-line transition-colors hover:text-ink"
          >
            ← zurück zu Semester
          </Link>
        </p>
      </div>
    </div>
  );
}
