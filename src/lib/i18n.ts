"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { de as deLocale, type Locale } from "date-fns/locale";

export type Lang = "de" | "en";

/**
 * German-first i18n: keys ARE the English strings, the dictionary only
 * carries German. `t()` falls back to the key, so untranslated strings
 * degrade to English instead of breaking. Default: German (the app's
 * audience), persisted per device.
 */

const de: Record<string, string> = {
  /* nav + shell */
  Overview: "Übersicht",
  Tasks: "Aufgaben",
  Homework: "Hausaufgaben",
  Grades: "Noten",
  Timetable: "Stundenplan",
  Calendar: "Kalender",
  "Study Room": "Lernraum",
  Account: "Konto",
  "Quick menu": "Schnellmenü",
  "the study desk": "dein schreibtisch",
  "sign out": "abmelden",
  "Sign in to sync": "Anmelden zum Sync",
  "checking…": "prüfe…",
  "checking session…": "Sitzung prüfen…",
  "offline, saved locally": "offline, lokal gespeichert",
  "syncing…": "synchronisiere…",
  "sync error": "Sync-Fehler",
  "not synced yet": "noch nicht synchronisiert",
  synced: "synchronisiert",
  "Data lives in your browser": "Daten liegen in deinem Browser",
  "(localStorage), nothing": "(localStorage), nichts",
  "leaves this device.": "verlässt dieses Gerät.",

  /* common */
  Today: "Heute",
  Tomorrow: "Morgen",
  Yesterday: "Gestern",
  done: "fertig",
  today: "heute",
  tomorrow: "morgen",
  "Overdue since": "überfällig seit",
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
  Delete: "Löschen",
  Done: "Fertig",
  Close: "Schließen",
  Edit: "Bearbeiten",
  Add: "Hinzufügen",
  "Saves automatically": "Speichert automatisch",
  Untitled: "Ohne Titel",

  /* dashboard */
  "Up late": "Noch wach",
  "Good morning": "Guten Morgen",
  "Good afternoon": "Guten Nachmittag",
  "Good evening": "Guten Abend",
  "task due today.": "Aufgabe heute fällig.",
  "tasks due today.": "Aufgaben heute fällig.",
  "Nothing due today.": "Nichts fällig heute.",
  "open tasks": "offene Aufgaben",
  homework: "Hausaufgaben",
  tasks: "Aufgaben",
  grade: "Note",
  overdue: "überfällig",
  "Now · until": "Jetzt · bis",
  "min left": "Min. rest",
  "Next in": "Nächste in",
  "Next at": "Nächste um",
  "Lessons are over for today.": "Für heute ist Schluss.",
  "all tasks →": "alle Aufgaben →",
  "Add a task for today and press Enter": "Aufgabe für heute ergänzen und Enter drücken",
  "Nothing due today. The desk is calm.": "Nichts fällig. Der Tisch ist leer.",
  "today · overdue": "heute · überfällig",
  "up next": "als nächstes",
  "The queue is empty.": "Warteschlange leer.",
  "No open homework.": "Keine offenen Hausaufgaben.",
  "This week": "Diese Woche",
  "calendar →": "kalender →",
  "no entries in the next 7 days": "keine Einträge in den nächsten 7 Tagen",
  Subjects: "Fächer",
  "manage grades →": "noten verwalten →",
  "Delete all tasks, grades, events and subjects? This cannot be undone.":
    "Alle Aufgaben, Noten, Termine und Fächer löschen? Das kann nicht rückgängig gemacht werden.",
  "clear all data": "alle Daten löschen",
  "in X days": "in {n} Tagen",
  "Mark homework as done": "Hausaufgabe abhaken",
  "Mark as done": "Als erledigt markieren",
  "mark as done": "abhaken",

  /* tasks */
  "New task": "Neue Aufgabe",
  "Add a task and press Enter": "Aufgabe eintippen und Enter drücken",
  open: "offen",
  all: "alle",
  Overdue: "Überfällig",
  "Due date": "Fälligkeit",
  "No tasks here": "Keine Aufgaben hier",
  "No homework here": "Keine Hausaufgaben hier",
  "Finished homework will collect here.": "Erledigte Hausaufgaben sammeln sich hier.",
  "Add what your teachers assigned: with a due date and subject, it shows up on the calendar too.":
    "Trag ein, was die Lehrkräfte aufgegeben haben: mit Fälligkeit und Fach erscheint es auch im Kalender.",
  "Add a task with a due date, priority and subject. It will also show up on the calendar.":
    "Aufgabe mit Fälligkeit, Priorität und Fach anlegen. Sie erscheint auch im Kalender.",
  "Nothing completed yet": "Noch nichts erledigt",
  "Finished tasks will collect here.": "Erledigtes sammelt sich hier.",
  "Edit task": "Aufgabe bearbeiten",
  "Delete task": "Aufgabe löschen",
  "Mark as open": "Wieder öffnen",

  /* calendar */
  "deadlines, sessions & task due dates": "Termine, Lernzeiten & Fälligkeiten",
  month: "Monat",
  week: "Woche",
  "New entry": "Neuer Eintrag",
  "Study session": "Lernzeit",
  Deadline: "Frist",
  Exam: "Schulaufgabe",
  Event: "Termin",
  "due tasks": "fällige Aufgaben",
  free: "frei",
  "Click a day for its agenda · click an entry to edit or tick it off":
    "Tag antippen für die Agenda · Eintrag antippen zum Bearbeiten",
  "nothing planned": "nichts geplant",
  entries: "Einträge",
  entry: "Eintrag",
  "A free day. Add an entry below or enjoy it.":
    "Ein freier Tag. Trag etwas ein oder genieß ihn.",
  "click an entry to edit · tasks can be ticked here":
    "Eintrag antippen zum Bearbeiten · Aufgaben hier abhaken",
  Title: "Titel",
  "Date": "Datum",
  "Time (optional)": "Uhrzeit (optional)",
  Type: "Typ",
  Subject: "Fach",
  "Add grade": "Note eintragen",
  "No subjects yet": "Noch keine Fächer",
  "Subjects are shared across tasks, grades and the calendar. Create one to start tracking grades.":
    "Fächer teilen sich über Aufgaben, Noten und Kalender. Leg eins an, um Noten zu tracken.",
  Schnitt: "Schnitt",
  "Notes (optional)": "Notizen (optional)",
  "e.g. Library session, History midterm…": "z.B. Bibliothek, Geschichtesarbeit…",
  "Room, materials to bring…": "Raum, Unterlagen…",

  /* timetable */
  "paste your timetable as JSON, formatted automatically":
    "Stundenplan als JSON einfügen – wird automatisch formatiert",
  "Edit JSON": "JSON bearbeiten",
  Clear: "Leeren",
  "Clear the whole timetable?": "Ganzen Stundenplan löschen?",
  "Substitute plan (Vertretungsplan)": "Vertretungsplan",
  fetched: "geholt",
  connected: "verbunden",
  substitutions: "Vertretungen",
  substitution: "Vertretung",
  "upcoming tests": "anstehende Schulaufgaben",
  "upcoming test": "anstehende Schulaufgabe",
  "Portal URL": "Portal-URL",
  "Portal email": "Portal-E-Mail",
  "Portal password": "Portal-Passwort",
  "fetch automatically on every visit": "beim Öffnen automatisch laden",
  "Fetch now": "Jetzt laden",
  "Fetching…": "Lade…",
  "credentials are stored only on this device and sent only to your own server when fetching.":
    "Zugangsdaten bleiben auf diesem Gerät und gehen nur an deinen eigenen Server.",
  cancelled: "entfall",
  substituted: "vertreten",
  Substitutions: "Vertretungen",
  "Upcoming tests": "Anstehende Schulaufgaben",
  "schulaufgaben from the Eltern-Portal, added to your tasks automatically":
    "Schulaufgaben aus dem Eltern-Portal – automatisch in deinen Aufgaben",
  "Portal rejected the login. Check portal URL, email and password.":
    "Portal hat die Anmeldung abgelehnt. URL, E-Mail und Passwort prüfen.",
  "The portal could not be reached.": "Das Portal ist nicht erreichbar.",
  "Fill in portal URL, email and password below.":
    "Portal-URL, E-Mail und Passwort unten eintragen.",
  "Sign in first (sidebar).": "Zuerst anmelden (Seitenleiste).",
  "The portal URL is not a valid address.": "Die Portal-URL ist keine gültige Adresse.",
  "The portal URL must start with https://": "Die Portal-URL muss mit https:// beginnen.",
  "The portal URL needs a full hostname (e.g. evbspar.eltern-portal.org).":
    "Die Portal-URL braucht einen vollen Hostnamen (z.B. evbspar.eltern-portal.org).",
  "The portal URL must point at a public host.":
    "Die Portal-URL muss auf einen öffentlichen Host zeigen.",

  /* study room */
  "upload material, tick the context, then chat, quiz or drill flashcards":
    "Material hochladen, Kontext anhaken, dann chatten, Quizzen oder Lernkarten",
  "AI ready": "KI bereit",
  "AI key missing": "KI-Schlüssel fehlt",
  Material: "Material",
  "Add material": "Material hinzufügen",
  Chat: "Chat",
  Quiz: "Quiz",
  Flashcards: "Lernkarten",
  "Ask your documents": "Frag deine Unterlagen",
  Practice: "Üben",
  "Test yourself": "Teste dich",
  "No quiz yet": "Noch kein Quiz",
  "No decks yet": "Noch keine Stapel",
  "Deck learned.": "Stapel gelernt.",
  "Round": "Runde",
  "round done.": "fertig.",
  known: "gewusst",
  again: "wiederholen",
  Again: "Nochmal",
  "Got it": "Verstanden",
  Flip: "Umdrehen",
  question: "Frage",
  answer: "Antwort",
  "click to flip": "zum Umdrehen klicken",
  "Restart deck": "Stapel neu starten",
  "New deck": "Neuer Stapel",
  "Export deck as CSV": "Stapel als CSV exportieren",
  "Delete deck": "Stapel löschen",
  "Empty deck": "Leerer Stapel",
  "This deck has no cards.": "Dieser Stapel hat keine Karten.",
  "Next question": "Nächste Frage",
  "See results": "Ergebnisse",
  "correct": "richtig",
  "your answer:": "deine Antwort:",
  "New homework": "Neue Hausaufgaben",

  /* command palette */
  "Jump somewhere, or type a task, homework or exam":
    "Irgendwohin springen, oder Aufgabe / Hausaufgabe / Schulaufgabe tippen",
  "go to": "zu",
  "New task:": "Neue Aufgabe:",
  "New homework:": "Neue Hausaufgaben:",
  "New exam (SA):": "Neue Schulaufgabe:",
  "Switch to light mode": "Zu hellem Modus wechseln",
  "Switch to dark mode": "Zu dunklem Modus wechseln",
  "Sync now": "Jetzt synchronisieren",
  theme: "design",
  sync: "sync",
  "Nothing matches.": "Nichts gefunden.",
  "Enter to run": "Enter startet",
  "↑↓ to choose": "↑↓ zum Wählen",

  /* onboarding */
  "Set up your desk": "Richte deinen Tisch ein",
  "of 3 done · everything saves automatically":
    "von 3 erledigt · alles speichert automatisch",
  "Skip setup": "Später",
  "Your weekly timetable": "Dein Stundenplan",
  "Paste the JSON below or": "JSON unten einfügen oder",
  "do it on the timetable page": "auf der Stundenplan-Seite erledigen",
  "Format timetable": "Stundenplan formatieren",
  "Use example": "Beispiel nutzen",
  "Your subjects": "Deine Fächer",
  added: "hinzugefügt",
  "Comma separated. Tasks, homework, grades and the calendar all share them.":
    "Kommagetrennt. Aufgaben, Hausaufgaben, Noten und Kalender teilen sie sich.",
  "Mathe, Englisch, Physik…": "Mathe, Englisch, Physik…",
  "School portal": "Schulportal",
  "sign-in needed for sync": "Anmeldung nötig für Sync",
  "Optional: substitutions and upcoming tests flow in automatically. Credentials stay on this device.":
    "Optional: Vertretungen und Schulaufgaben kommen automatisch. Zugangsdaten bleiben auf dem Gerät.",
  "The portal rejected the login. URL, email and password prüfen.":
    "Portal hat die Anmeldung abgelehnt. URL, E-Mail und Passwort prüfen.",
  "Sign in first (sidebar) so the plan can sync.":
    "Zuerst anmelden (Seitenleiste), damit der Plan synct.",
  "The portal could not be reached. You can do this later on the timetable page.":
    "Das Portal ist nicht erreichbar. Geht später auf der Stundenplan-Seite.",
  Connect: "Verbinden",
  "all set, the desk fills itself from here":
    "alles bereit – ab jetzt füllt sich der Tisch von allein",

  /* auth */
  "sign in, two-factor & sync. Credentials live with your Appwrite project.":
    "Anmeldung, Zwei-Faktor & Sync. Zugangsdaten liegen bei deiner Appwrite-Instanz.",

  /* landing */
  Features: "Funktionen",
  "How it works": "So funktioniert's",
  Docs: "Doku",
  "Open the app": "App öffnen",
  "Plans change at 7:45.": "Um 7:45 kippt der Plan.",
  "Your desk doesn't.": "Dein Tisch nicht.",
  "Semester puts your timetable, tasks, homework, grades and study material on one desk that keeps up when the substitute plan flips. Web and phone, always in sync.":
    "Stundenplan, Aufgaben, Hausaufgaben, Noten und Lernmaterial auf einem Tisch, der mithält, wenn der Vertretungsplan kippt. Web und Handy, immer synchron.",
  "Open your desk": "Tisch öffnen",
  "Download for Android": "Für Android laden",
  "avg. grade": "Notenschnitt",
  "tomorrow, 3rd pd.": "morgen, 3. Std.",
  "Gym · Fr. Lauf · 18 min left": "Gym · Fr. Lauf · 18 Min. rest",
  "DER PLAN KIPPT": "DER PLAN KIPPT",
  "The plan you copied this morning is already old.":
    "Der Plan von heute früh ist schon wieder alt.",
  "Semester pulls the substitute plan straight from your school portal and rewrites the grid before you reach school: cancellations crossed out, substitutes and rooms filled in. Upcoming Schulaufgaben land on your calendar and in your tasks on their own.":
    "Semester zieht den Vertretungsplan direkt aus deinem Schulportal und schreibt das Grid um, bevor du in der Schule bist: Entfall durchgestrichen, Vertretungen und Räume eingetragen. Anstehende Schulaufgaben landen von selbst im Kalender und in den Aufgaben.",
  "The desk itself.": "Der Tisch selbst.",
  "One overview with everything that matters today: open tasks, due dates, your grade average and the week ahead.":
    "Eine Übersicht mit allem, was heute zählt: offene Aufgaben, Fälligkeiten, dein Notenschnitt und die Woche.",
  "Everything a school week throws at you.": "Alles, was eine Schulwoche wirft.",
  "Six tools that share one set of subjects, one timetable and one database. No export-import dances between apps.":
    "Sechs Tools, die sich Fächer, Stundenplan und Datenbank teilen. Kein Export-Import-Hüpfen zwischen Apps.",
  "Tasks & homework": "Aufgaben & Hausaufgaben",
  "Due dates with times, priorities, subject tags and notes. The overview groups them by urgency: overdue, today, this week.":
    "Fälligkeiten mit Uhrzeit, Prioritäten, Fächer-Tags und Notizen. Die Übersicht gruppiert nach Dringlichkeit: überfällig, heute, diese Woche.",
  "Weighted per-subject averages in the Punkte system, shown as the German Note scale.":
    "Gewichtete Noten pro Fach im Punktesystem, angezeigt als deutsche Note.",
  "Timetable with live substitutions": "Stundenplan mit live Vertretungen",
  "Import your weekly grid once, then watch the school portal rewrite it live. Double periods, rooms and substitutes included.":
    "Dein Wochenplan einmal importieren, dann schreibst das Schulportal ihn live um. Doppelstunden, Räume und Vertretungen inklusive.",
  "Month and week views that combine events, exams, deadlines and task due dates in one place.":
    "Monat- und Wochenansicht mit Terminen, Schulaufgaben, Fristen und Aufgaben-Fälligkeiten an einem Ort.",
  "Daily digest": "Tages-Digest",
  "Every afternoon, a push with tomorrow's classes, overdue homework and upcoming exams.":
    "Nachmittags eine Push mit dem morgigen Tag, überfälligen Hausaufgaben und anstehenden Schulaufgaben.",
  "AI study room": "KI-Lernraum",
  "Chat with grounded answers that cite your documents, and auto-build flashcard decks.":
    "Chat mit Antworten, die deine Unterlagen zitieren, und automatisch gebauten Lernkarten-Stapeln.",
  "Your documents, answered.": "Deine Unterlagen, beantwortet.",
  "Upload PDFs, slides or notes and ask away. Answers are grounded in your material and cite the exact page.":
    "PDFs, Folien oder Notizen hochladen und losfragen. Antworten basieren auf deinem Material und zitieren die genaue Seite.",
  "One Tuesday, on Semester.": "Ein Dienstag mit Semester.",
  "From the morning plan flip to the evening study session. The boring parts are the feature.":
    "Von der Plan-Änderung am Morgen bis zur Lernsession am Abend. Die langweiligen Teile sind das Feature.",
  "The portal flips.": "Das Portal kippt.",
  "Sport is cancelled, Fr. Lauf takes over in the Gym. The grid on your phone is already rewritten before you leave the house.":
    "Sport fällt aus, Fr. Lauf übernimmt in der Turnhalle. Das Grid auf dem Handy ist schon umgeschrieben, bevor du das Haus verlässt.",
  "the grid knows": "das grid weiß es",
  "Now: Sport, Gym, 18 minutes left.": "Jetzt: Sport, Turnhalle, 18 Minuten rest.",
  "The overview shows the running lesson with a progress bar, then the next one. No counting periods in your head.":
    "Die Übersicht zeigt die laufende Stunde mit Fortschrittsbalken, dann die nächste. Kein Stunden-Zählen im Kopf.",
  "Tick it off, type the next one.": "Abhaken, nächste eintippen.",
  "Today's pile at the top, quick-add one field below it. Homework and tasks live side by side and land on the calendar by themselves.":
    "Der heutige Stapel oben, darunter ein Schnell-Eingabefeld. Hausaufgaben und Aufgaben liegen nebeneinander und landen von selbst im Kalender.",
  "Your phone knows tomorrow.": "Dein Handy kennt morgen.",
  "An afternoon push: tomorrow's classes, what is overdue, which Schulaufgaben are creeping closer.":
    "Eine Push am Nachmittag: morgige Stunden, was überfällig ist, welche Schulaufgaben näher rücken.",
  "Ask your own documents.": "Frag deine eigenen Unterlagen.",
  "Upload the history PDF once, then ask. Answers cite the exact page, and flashcard decks build themselves.":
    "Das Geschichts-PDF einmal hochladen, dann fragen. Antworten zitieren die genaue Seite, Lernkarten-Stapel bauen sich selbst.",
  Autosave: "Autosave",
  "No save buttons, anywhere.": "Keine Speichern-Buttons. Nirgends.",
  "Every edit commits as you type. Closing a form can never lose input, on web and phone alike.":
    "Jede Änderung speichert beim Tippen. Formulare schließen verliert nie etwas – am Web wie am Handy.",
  Sync: "Sync",
  "Offline first, always agreeing.": "Offline zuerst, immer im Reinen.",
  "Edits live locally first and win over the cloud until their push lands. Devices agree without coordination.":
    "Änderungen leben zuerst lokal und gewinnen gegen die Cloud, bis ihr Push ankommt. Geräte einigen sich ohne Abstimmung.",
  Privacy: "Privatsphäre",
  "Credentials stay put.": "Zugangsdaten bleiben, wo sie sind.",
  "Portal logins never leave your device except to your own server for the fetch. Self-hosted, open source.":
    "Portal-Logins verlassen dein Gerät nie – außer an deinen eigenen Server beim Laden. Self-hosted, Open Source.",
  "Set up your desk in one afternoon.": "An einem Nachmittag eingerichtet.",
  "Paste your timetable as JSON, connect your school portal, install the app. Everything else follows.":
    "Stundenplan als JSON einfügen, Schulportal verbinden, App installieren. Der Rest kommt von allein.",
  "Read the docs": "Doku lesen",
  "Open source and self-hostable.": "Open Source und self-hostable.",
};

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>()(
  persist((set) => ({ lang: "de", setLang: (lang) => set({ lang }) }), {
    name: "semester.lang",
    version: 1,
  }),
);

/** current language outside React (pure helpers like dueInfo) */
export function currentLang(): Lang {
  return useLangStore.getState().lang;
}

/** the German dictionary — keys are the English strings */
export function t(key: string): string {
  if (currentLang() === "en") return key;
  return de[key] ?? key;
}

/** bound hook for components */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (key: string) => (lang === "en" ? key : de[key] ?? key);
}

/** date-fns locale matching the language */
export function dateLocale(lang?: Lang): Locale | undefined {
  const l = lang ?? currentLang();
  return l === "de" ? deLocale : undefined;
}

export function useDateLocale(): Locale | undefined {
  const lang = useLangStore((s) => s.lang);
  return dateLocale(lang);
}
