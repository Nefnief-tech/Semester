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
  "the study desk": "dein Schreibtisch",
  "sign out": "abmelden",
  "Sign in to sync": "Zum Synchronisieren anmelden",
  "checking…": "prüfe…",
  "checking session…": "Sitzung wird geprüft…",
  "offline, saved locally": "offline, lokal gespeichert",
  "syncing…": "synchronisiere…",
  "sync error": "Sync-Fehler",
  "not synced yet": "noch nicht synchronisiert",
  synced: "synchronisiert",
  "Data lives in your browser": "Deine Daten liegen in deinem Browser",
  "(localStorage), nothing": "(localStorage), nichts",
  "leaves this device.": "verlässt dieses Gerät.",

  /* common */
  Today: "Heute",
  Tomorrow: "Morgen",
  Yesterday: "Gestern",
  done: "erledigt",
  today: "heute",
  tomorrow: "morgen",
  "Overdue since": "Überfällig seit",
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
  "Up late": "Noch wach?",
  "Good morning": "Guten Morgen",
  "Good afternoon": "Guten Tag",
  "Good evening": "Guten Abend",
  "task due today.": "Aufgabe ist heute fällig.",
  "tasks due today.": "Aufgaben sind heute fällig.",
  "Nothing due today.": "Heute ist nichts fällig.",
  "open tasks": "offene Aufgaben",
  homework: "Hausaufgaben",
  tasks: "Aufgaben",
  grade: "Note",
  overdue: "überfällig",
  "Now · until": "Jetzt · bis",
  "min left": "Min. übrig",
  "Next in": "Als Nächstes in",
  "Next at": "Als Nächstes um",
  "Lessons are over for today.": "Für heute hast du Schluss.",
  "all tasks →": "Alle Aufgaben →",
  "Add a task for today and press Enter":
    "Aufgabe für heute eintippen und Enter drücken",
  "Nothing due today. The desk is calm.":
    "Heute ist nichts fällig. Auf dem Schreibtisch herrscht Ruhe.",
  "today · overdue": "heute · überfällig",
  "up next": "als Nächstes",
  "The queue is empty.": "Nichts mehr auf der Liste.",
  "No open homework.": "Keine offenen Hausaufgaben.",
  "This week": "Diese Woche",
  "calendar →": "Kalender →",
  "no entries in the next 7 days": "keine Einträge in den nächsten 7 Tagen",
  Subjects: "Fächer",
  "manage grades →": "Noten verwalten →",
  "Delete all tasks, grades, events and subjects? This cannot be undone.":
    "Alle Aufgaben, Noten, Termine und Fächer löschen? Das lässt sich nicht rückgängig machen.",
  "clear all data": "alle Daten löschen",
  "in {n} days": "in {n} Tagen",
  "Mark homework as done": "Hausaufgabe als erledigt markieren",
  "Mark as done": "Als erledigt markieren",
  "mark as done": "als erledigt markieren",

  /* tasks */
  "New task": "Neue Aufgabe",
  "Add a task and press Enter": "Aufgabe eintippen und Enter drücken",
  open: "offen",
  all: "alle",
  Overdue: "Überfällig",
  "Due date": "Fällig am",
  "No tasks here": "Hier gibt es keine Aufgaben",
  "No homework here": "Hier gibt es keine Hausaufgaben",
  "Finished homework will collect here.":
    "Erledigte Hausaufgaben erscheinen hier.",
  "Add what your teachers assigned: with a due date and subject, it shows up on the calendar too.":
    "Trag ein, was deine Lehrer aufgegeben haben. Mit Fälligkeitsdatum und Fach erscheint es auch im Kalender.",
  "Add a task with a due date, priority and subject. It will also show up on the calendar.":
    "Leg eine Aufgabe mit Fälligkeitsdatum, Priorität und Fach an. Sie erscheint auch im Kalender.",
  "Nothing completed yet": "Noch nichts erledigt",
  "Finished tasks will collect here.": "Erledigte Aufgaben erscheinen hier.",
  "Edit task": "Aufgabe bearbeiten",
  "Delete task": "Aufgabe löschen",
  "Mark as open": "Wieder öffnen",

  /* calendar */
  "deadlines, sessions & task due dates":
    "Fristen, Lernzeiten und fällige Aufgaben",
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
    "Tag antippen für die Tagesübersicht · Eintrag antippen zum Bearbeiten oder Abhaken",
  "nothing planned": "nichts geplant",
  entries: "Einträge",
  entry: "Eintrag",
  "A free day. Add an entry below or enjoy it.":
    "Ein freier Tag. Trag unten etwas ein oder genieß ihn einfach.",
  "click an entry to edit · tasks can be ticked here":
    "Eintrag antippen zum Bearbeiten · Aufgaben kannst du hier abhaken",
  Title: "Titel",
  Date: "Datum",
  "Time (optional)": "Uhrzeit (optional)",
  Type: "Art",
  Subject: "Fach",
  "Add grade": "Note eintragen",
  "No subjects yet": "Noch keine Fächer",
  "Subjects are shared across tasks, grades and the calendar. Create one to start tracking grades.":
    "Fächer gelten für Aufgaben, Noten und Kalender gleichermaßen. Leg eins an, um deine Noten zu verfolgen.",
  Schnitt: "Schnitt",
  "Notes (optional)": "Notizen (optional)",
  "e.g. Library session, History midterm…":
    "z. B. Bibliothek, Schulaufgabe in Geschichte…",
  "Room, materials to bring…": "Raum, mitzubringende Unterlagen…",

  /* timetable */
  "paste your timetable as JSON, formatted automatically":
    "Stundenplan als JSON einfügen, er wird automatisch formatiert",
  "Edit JSON": "JSON bearbeiten",
  Clear: "Leeren",
  "Clear the whole timetable?": "Den ganzen Stundenplan löschen?",
  "Substitute plan (Vertretungsplan)": "Vertretungsplan",
  fetched: "abgerufen",
  connected: "verbunden",
  substitutions: "Vertretungen",
  substitution: "Vertretung",
  "upcoming tests": "anstehende Schulaufgaben",
  "upcoming test": "anstehende Schulaufgabe",
  "Portal URL": "Portal-URL",
  "Portal email": "Portal-E-Mail",
  "Portal password": "Portal-Passwort",
  "fetch automatically on every visit": "bei jedem Öffnen automatisch abrufen",
  "Fetch now": "Jetzt abrufen",
  "Fetching…": "Rufe ab…",
  "credentials are stored only on this device and sent only to your own server when fetching.":
    "Deine Zugangsdaten bleiben auf diesem Gerät und werden nur beim Abrufen an deinen eigenen Server geschickt.",
  cancelled: "Entfall",
  substituted: "vertreten",
  Substitutions: "Vertretungen",
  "Upcoming tests": "Anstehende Schulaufgaben",
  "schulaufgaben from the Eltern-Portal, added to your tasks automatically":
    "Schulaufgaben aus dem Elternportal, automatisch zu deinen Aufgaben hinzugefügt",
  "Portal rejected the login. Check portal URL, email and password.":
    "Das Portal hat die Anmeldung abgelehnt. Prüf Portal-URL, E-Mail und Passwort.",
  "The portal could not be reached.": "Das Portal ist nicht erreichbar.",
  "Fill in portal URL, email and password below.":
    "Trag unten Portal-URL, E-Mail und Passwort ein.",
  "Sign in first (sidebar).": "Melde dich zuerst an (Seitenleiste).",
  "The portal URL is not a valid address.":
    "Die Portal-URL ist keine gültige Adresse.",
  "The portal URL must start with https://":
    "Die Portal-URL muss mit https:// beginnen.",
  "The portal URL needs a full hostname (e.g. evbspar.eltern-portal.org).":
    "Die Portal-URL braucht einen vollständigen Hostnamen (z. B. evbspar.eltern-portal.org).",
  "The portal URL must point at a public host.":
    "Die Portal-URL muss auf einen öffentlich erreichbaren Host zeigen.",

  /* study room */
  "upload material, tick the context, then chat, quiz or drill flashcards":
    "Material hochladen, Kontext auswählen, dann chatten, ein Quiz machen oder Lernkarten üben",
  "AI ready": "KI bereit",
  "AI key missing": "KI-Schlüssel fehlt",
  Material: "Material",
  "Add material": "Material hinzufügen",
  Chat: "Chat",
  Quiz: "Quiz",
  Flashcards: "Lernkarten",
  "Ask your documents": "Frag deine Unterlagen",
  Practice: "Üben",
  "Test yourself": "Teste dich selbst",
  "No quiz yet": "Noch kein Quiz",
  "No decks yet": "Noch keine Stapel",
  "Deck learned.": "Stapel durchgelernt.",
  Round: "Runde",
  "round done.": "geschafft.",
  known: "gewusst",
  again: "nochmal",
  Again: "Nochmal",
  "Got it": "Gewusst",
  Flip: "Umdrehen",
  question: "Frage",
  answer: "Antwort",
  "click to flip": "zum Umdrehen tippen",
  "Restart deck": "Stapel neu starten",
  "New deck": "Neuer Stapel",
  "Export deck as CSV": "Stapel als CSV exportieren",
  "Delete deck": "Stapel löschen",
  "Empty deck": "Leerer Stapel",
  "This deck has no cards.": "Dieser Stapel enthält keine Karten.",
  "Next question": "Nächste Frage",
  "See results": "Ergebnis ansehen",
  correct: "richtig",
  "your answer:": "deine Antwort:",
  "New homework": "Neue Hausaufgabe",

  /* command palette */
  "Jump somewhere, or type a task, homework or exam":
    "Spring irgendwohin oder tipp eine Aufgabe, Hausaufgabe oder Schulaufgabe ein",
  "go to": "gehe zu",
  "New task:": "Neue Aufgabe:",
  "New homework:": "Neue Hausaufgabe:",
  "New exam (SA):": "Neue Schulaufgabe:",
  "Switch to light mode": "Zum hellen Modus wechseln",
  "Switch to dark mode": "Zum dunklen Modus wechseln",
  "Sync now": "Jetzt synchronisieren",
  theme: "Design",
  sync: "Sync",
  "Nothing matches.": "Nichts gefunden.",
  "Enter to run": "Enter zum Ausführen",
  "↑↓ to choose": "↑↓ zum Auswählen",

  /* onboarding */
  "Set up your desk": "Richte deinen Schreibtisch ein",
  "of 3 done · everything saves automatically":
    "von 3 erledigt · alles wird automatisch gespeichert",
  "Skip setup": "Später",
  "Your weekly timetable": "Dein Stundenplan",
  "Paste the JSON below or": "Füge unten das JSON ein oder",
  "do it on the timetable page": "mach es auf der Stundenplan-Seite",
  "Format timetable": "Stundenplan formatieren",
  "Use example": "Beispiel verwenden",
  "Your subjects": "Deine Fächer",
  added: "hinzugefügt",
  "Comma separated. Tasks, homework, grades and the calendar all share them.":
    "Durch Kommas getrennt. Aufgaben, Hausaufgaben, Noten und Kalender nutzen dieselben Fächer.",
  "Mathe, Englisch, Physik…": "Mathe, Englisch, Physik…",
  "School portal": "Schulportal",
  "sign-in needed for sync": "Anmeldung für den Sync nötig",
  "Optional: substitutions and upcoming tests flow in automatically. Credentials stay on this device.":
    "Optional: Vertretungen und anstehende Schulaufgaben kommen dann automatisch rein. Deine Zugangsdaten bleiben auf diesem Gerät.",
  "The portal rejected the login. URL, email and password prüfen.":
    "Das Portal hat die Anmeldung abgelehnt. Prüf URL, E-Mail und Passwort.",
  "Sign in first (sidebar) so the plan can sync.":
    "Melde dich zuerst an (Seitenleiste), damit der Plan synchronisiert werden kann.",
  "The portal could not be reached. You can do this later on the timetable page.":
    "Das Portal ist nicht erreichbar. Du kannst das später auf der Stundenplan-Seite nachholen.",
  Connect: "Verbinden",
  "all set, the desk fills itself from here":
    "Alles bereit. Ab jetzt füllt sich dein Schreibtisch von selbst.",

  /* auth */
  "sign in, two-factor & sync. Credentials live with your Appwrite project.":
    "Anmeldung, Zwei-Faktor-Authentifizierung und Sync. Deine Zugangsdaten liegen in deinem Appwrite-Projekt.",

  /* landing */
  Features: "Funktionen",
  "How it works": "So funktioniert's",
  Docs: "Doku",
  "Open the app": "App öffnen",
  "Plans change at 7:45.": "Um 7:45 ändert sich der Plan.",
  "Your desk doesn't.": "Dein Schreibtisch nicht.",
  "Semester puts your timetable, tasks, homework, grades and study material on one desk that keeps up when the substitute plan flips. Web and phone, always in sync.":
    "Semester vereint Stundenplan, Aufgaben, Hausaufgaben, Noten und Lernmaterial auf einem Schreibtisch, der mithält, wenn sich der Vertretungsplan ändert. Im Web und auf dem Handy, immer synchron.",
  "Open your desk": "Schreibtisch öffnen",
  "Download for Android": "Für Android herunterladen",
  "avg. grade": "Notenschnitt",
  "tomorrow, 3rd pd.": "morgen, 3. Std.",
  "Gym · Fr. Lauf · 18 min left": "Turnhalle · Fr. Lauf · noch 18 Min.",
  "DER PLAN KIPPT": "DER PLAN KIPPT",
  "The plan you copied this morning is already old.":
    "Der Plan von heute Morgen ist schon wieder veraltet.",
  "Semester pulls the substitute plan straight from your school portal and rewrites the grid before you reach school: cancellations crossed out, substitutes and rooms filled in. Upcoming Schulaufgaben land on your calendar and in your tasks on their own.":
    "Semester holt den Vertretungsplan direkt aus deinem Schulportal und passt den Stundenplan an, bevor du in der Schule bist: Entfallene Stunden sind durchgestrichen, Vertretungen und Räume eingetragen. Anstehende Schulaufgaben landen ganz von selbst in deinem Kalender und bei deinen Aufgaben.",
  "The desk itself.": "Der Schreibtisch selbst.",
  "One overview with everything that matters today: open tasks, due dates, your grade average and the week ahead.":
    "Eine Übersicht mit allem, was heute wichtig ist: offene Aufgaben, Fälligkeiten, dein Notenschnitt und die Woche, die vor dir liegt.",
  "Everything a school week throws at you.":
    "Alles, was eine Schulwoche so mit sich bringt.",
  "Six tools that share one set of subjects, one timetable and one database. No export-import dances between apps.":
    "Sechs Werkzeuge, die sich Fächer, Stundenplan und Datenbank teilen. Kein ständiges Exportieren und Importieren zwischen verschiedenen Apps.",
  "Tasks & homework": "Aufgaben und Hausaufgaben",
  "Due dates with times, priorities, subject tags and notes. The overview groups them by urgency: overdue, today, this week.":
    "Fälligkeiten mit Uhrzeit, Prioritäten, Fächern und Notizen. Die Übersicht sortiert sie nach Dringlichkeit: überfällig, heute, diese Woche.",
  "Weighted per-subject averages in the Punkte system, shown as the German Note scale.":
    "Gewichtete Durchschnitte pro Fach im Punktesystem, angezeigt als deutsche Schulnote.",
  "Timetable with live substitutions": "Stundenplan mit Live-Vertretungen",
  "Import your weekly grid once, then watch the school portal rewrite it live. Double periods, rooms and substitutes included.":
    "Importier deinen Wochenplan einmal, danach passt das Schulportal ihn live an. Mit Doppelstunden, Räumen und Vertretungen.",
  "Month and week views that combine events, exams, deadlines and task due dates in one place.":
    "Monats- und Wochenansicht, in der Termine, Schulaufgaben, Fristen und fällige Aufgaben an einem Ort zusammenlaufen.",
  "Daily digest": "Tagesrückblick",
  "Every afternoon, a push with tomorrow's classes, overdue homework and upcoming exams.":
    "Jeden Nachmittag eine Push-Nachricht mit den Stunden von morgen, überfälligen Hausaufgaben und anstehenden Schulaufgaben.",
  "AI study room": "KI-Lernraum",
  "Chat with grounded answers that cite your documents, and auto-build flashcard decks.":
    "Ein Chat mit Antworten, die sich auf deine Unterlagen stützen und daraus zitieren, dazu Lernkarten-Stapel, die sich automatisch erstellen.",
  "Your documents, answered.": "Deine Unterlagen, beantwortet.",
  "Upload PDFs, slides or notes and ask away. Answers are grounded in your material and cite the exact page.":
    "Lad PDFs, Folien oder Notizen hoch und frag einfach drauflos. Die Antworten basieren auf deinem Material und nennen die genaue Seite.",
  "One Tuesday, on Semester.": "Ein Dienstag mit Semester.",
  "From the morning plan flip to the evening study session. The boring parts are the feature.":
    "Von der Planänderung am Morgen bis zur Lernrunde am Abend. Gerade die lästigen Dinge nimmt dir die App ab.",
  "The portal flips.": "Das Portal ändert den Plan.",
  "Sport is cancelled, Fr. Lauf takes over in the Gym. The grid on your phone is already rewritten before you leave the house.":
    "Sport fällt aus, Fr. Lauf übernimmt in der Turnhalle. Auf deinem Handy steht der neue Plan schon, bevor du aus dem Haus gehst.",
  "the grid knows": "der Plan weiß Bescheid",
  "Now: Sport, Gym, 18 minutes left.":
    "Jetzt: Sport, Turnhalle, noch 18 Minuten.",
  "The overview shows the running lesson with a progress bar, then the next one. No counting periods in your head.":
    "Die Übersicht zeigt die laufende Stunde mit Fortschrittsbalken und danach die nächste. Du musst die Stunden nicht im Kopf mitzählen.",
  "Tick it off, type the next one.": "Abhaken und die nächste eintippen.",
  "Today's pile at the top, quick-add one field below it. Homework and tasks live side by side and land on the calendar by themselves.":
    "Oben der Stapel für heute, darunter ein Feld zum schnellen Hinzufügen. Hausaufgaben und Aufgaben stehen nebeneinander und landen von selbst im Kalender.",
  "Your phone knows tomorrow.": "Dein Handy weiß, was morgen ansteht.",
  "An afternoon push: tomorrow's classes, what is overdue, which Schulaufgaben are creeping closer.":
    "Eine Push-Nachricht am Nachmittag: die Stunden von morgen, was überfällig ist und welche Schulaufgaben näher rücken.",
  "Ask your own documents.": "Frag deine eigenen Unterlagen.",
  "Upload the history PDF once, then ask. Answers cite the exact page, and flashcard decks build themselves.":
    "Lad das Geschichts-PDF einmal hoch und frag dann einfach. Die Antworten nennen die genaue Seite, und Lernkarten-Stapel entstehen von selbst.",
  Autosave: "Automatisch speichern",
  "No save buttons, anywhere.": "Keine Speichern-Buttons. Nirgends.",
  "Every edit commits as you type. Closing a form can never lose input, on web and phone alike.":
    "Jede Änderung wird beim Tippen gespeichert. Wenn du ein Formular schließt, geht nichts verloren, im Web genauso wie auf dem Handy.",
  Sync: "Sync",
  "Offline first, always agreeing.": "Erst offline, dann überall gleich.",
  "Edits live locally first and win over the cloud until their push lands. Devices agree without coordination.":
    "Änderungen entstehen zuerst lokal und haben Vorrang vor der Cloud, bis sie hochgeladen sind. Deine Geräte gleichen sich von allein ab.",
  Privacy: "Datenschutz",
  "Credentials stay put.": "Deine Zugangsdaten bleiben bei dir.",
  "Portal logins never leave your device except to your own server for the fetch. Self-hosted, open source.":
    "Portal-Logins verlassen dein Gerät nur in Richtung deines eigenen Servers, und auch nur zum Abrufen. Selbst gehostet, Open Source.",
  "Set up your desk in one afternoon.": "An einem Nachmittag eingerichtet.",
  "Paste your timetable as JSON, connect your school portal, install the app. Everything else follows.":
    "Stundenplan als JSON einfügen, Schulportal verbinden, App installieren. Der Rest läuft von allein.",
  "Read the docs": "Doku lesen",
  "Open source and self-hostable.": "Open Source und selbst hostbar.",

  /* landing · mini-UI labels, alt texts, aria */
  Pd: "Std.",
  Mon: "Mo",
  Wed: "Mi",
  Fri: "Fr",
  "This week on the grid": "Diese Woche im Plan",
  "Preview of Semester's Today view: the current lesson with a progress bar and two open tasks":
    "Vorschau der Semester-Übersicht: die laufende Stunde mit Fortschrittsbalken und zwei offene Aufgaben",
  "Timetable fragment where Sport on Wednesday is cancelled and Fr. Lauf substitutes Sport on Friday":
    "Stundenplan-Ausschnitt: Sport fällt am Mittwoch aus, am Freitag vertritt Fr. Lauf den Sportunterricht in der Turnhalle",
  "The Semester overview: greeting, current lesson, task queue, week strip and subject grades":
    "Die Semester-Übersicht: Begrüßung, laufende Stunde, Aufgabenliste, Wochenleiste und Fachnoten",
  "Semester timetable with a cancelled and a substituted lesson marked":
    "Semester-Stundenplan mit einer markierten entfallenen und einer vertretenen Stunde",
  "AI study room chat answering with a citation from an uploaded document":
    "KI-Lernraum-Chat, der mit einem Zitat aus einem hochgeladenen Dokument antwortet",

  /* timetable editor + holidays + school year */
  "Edit timetable": "Stundenplan bearbeiten",
  "build your grid cell by cell, or paste it as JSON":
    "Plan Zelle für Zelle aufbauen, oder als JSON einfügen",
  "click a cell to edit it · new cell? just tap the empty slot":
    "Zelle antippen zum Bearbeiten · neue Stunde? Einfach auf einen leeren Slot tippen",
  "your weekly grid, overlaid with live substitutions":
    "Dein Wochenplan, überlagert mit Live-Vertretungen",
  "Build in the editor": "Im Editor aufbauen",
  "Paste JSON": "JSON einfügen",
  "Add period": "Stunde hinzufügen",
  "Add Saturday": "Samstag ergänzen",
  "Tap a cell to place a subject · the time applies to the whole period row":
    "Zelle antippen und Fach eintragen · Die Zeit gilt für die ganze Reihe",
  Period: "Stunde",
  Teacher: "Lehrkraft",
  Room: "Raum",
  Save: "Speichern",
  End: "Ende",
  "apply this time to the whole period row": "Zeit für die ganze Reihe übernehmen",
  Tue: "Di",
  Thu: "Do",
  Sat: "Sa",
  Sun: "So",
  "School holidays": "Schulferien",
  "Public holiday": "Gesetzlicher Feiertag",
  until: "bis",
  "no lessons today": "heute keine Stunden",
  "Ferien & Feiertage": "Ferien & Feiertage",
  Bundesland: "Bundesland",
  "Ferien and Feiertage show up in the calendar, on the desk and next to your timetable. Stays on this device.":
    "Ferien und Feiertage erscheinen im Kalender, auf dem Tisch und neben deinem Stundenplan. Bleibt auf diesem Gerät.",
  "not set, no holidays shown": "nicht gesetzt, ohne Ferien und Feiertage",
  "next:": "nächste Ferien:",
  "School year": "Schuljahr",
  "Start the next school year": "Nächstes Schuljahr starten",
  "Archived years": "Archivierte Jahre",
  "Delete this archive? The JSON backup file stays on your device.":
    "Dieses Archiv löschen? Die JSON-Sicherheitskopie bleibt auf deinem Gerät.",
  "finished a school year? archive it here and start fresh - grades, homework, events and tasks move into the archive, subjects stay.":
    "Schuljahr geschafft? Archiviere es hier und starte neu: Noten, Hausaufgaben, Termine und Aufgaben wandern ins Archiv, Fächer bleiben.",
  "New school year": "Neues Schuljahr",
  "Archive & start fresh": "Archivieren & neu starten",
  "the archive lives on this device only, keep the downloaded backup somewhere safe.":
    "Das Archiv liegt nur auf diesem Gerät. Bewahre die heruntergeladene Sicherungskopie gut auf.",
  "Fresh start: the archive holds the finished year, the backup is in your downloads.":
    "Frisch gestartet: Das Archiv enthält das alte Schuljahr, die Sicherungskopie liegt in deinen Downloads.",
  "without subject": "ohne Fach",
  "The finished year is archived on this device and a JSON backup downloads first. Subjects stay; pick what starts empty:":
    "Das alte Schuljahr wird auf diesem Gerät archiviert und zuerst als JSON-Sicherung heruntergeladen. Fächer bleiben; wähl aus, was leer startet:",

  /* study room copy */
  context: "Kontext",
  "AI access": "KI-Zugang",
  "Ask something about your material…": "Frag irgendwas zu deinem Material…",
  "Questions about {name}. Answers cite their sources.":
    "Fragen zu {name}. Antworten nennen die Quellen.",
  "Questions about {name} and {n} more selected documents. Answers cite their sources.":
    "Fragen zu {name} und {n} weiteren ausgewählten Dokumenten. Antworten nennen die Quellen.",
  "No documents selected, so the assistant will answer from general knowledge. Tick some documents under Material to ground it.":
    "Keine Dokumente gewählt, die KI antwortet aus Allgemeinwissen. Hake unter Material Dokumente an, dann antwortet sie auf deiner Grundlage.",
  "Summarize the key ideas": "Fasse die Kernideen zusammen",
  "Quiz me on this material": "Quizze mich zu dem Material",
  "Explain the hardest concept step by step": "Erkläre das Schwerste Schritt für Schritt",
  "Make a study plan for the exam": "Mach einen Lernplan für die Schulaufgabe",
  "What can the study room do?": "Was kann der Lernraum?",
  "How do flashcard decks work?": "Wie funktionieren Lernkarten-Stapel?",
  "Drop your material here": "Material hier ablegen",
  "Upload lecture notes, slides or chapters - they become the context for flashcards and chat.":
    "Unterrichtsnotizen, Folien oder Kapitel hochladen - sie werden zur Grundlage für Lernkarten und Chat.",
  "Export as CSV": "Als CSV exportieren",
  "Previous card": "Vorherige Karte",
  Shuffle: "Mischen",
  "Reset progress": "Fortschritt zurücksetzen",
  "Turn your ticked documents into a multiple-choice quiz and test yourself.":
    "Aus deinen angehakten Dokumenten wird ein Multiple-Choice-Quiz zum Selbsttest.",
  "Upload material first and tick it as AI context, then generate a quiz.":
    "Zuerst Material hochladen und als KI-Kontext anhaken, dann ein Quiz erstellen.",
  "Turn your selected documents into a deck of flashcards.":
    "Aus deinen gewählten Dokumenten wird ein Stapel Lernkarten.",
  "Upload material first and tick it as AI context, then generate your deck.":
    "Zuerst Material hochladen und als KI-Kontext anhaken, dann den Stapel erstellen.",

  /* grades */
  "Punkte system (0-15) · weighted averages": "Punktesystem (0–15) · gewichtete Durchschnitte",
  overall: "gesamt",
  "across {n} subjects · {m} graded items": "über {n} Fächer · {m} Noten",
  "New subject": "Neues Fach",
  "Σ weight": "Σ Gewichtung",
  "(relative)": "(relativ)",
  "Delete {name}? This also removes its grades.":
    "\"{name}\" löschen? Das entfernt auch alle seine Noten.",
  grades: "Noten",
  "Target grade": "Zielnote",
  "next grade at weight {w}: at least {p} pts ({g})":
    "nächste Arbeit (Gew. {w}): mindestens {p} Pkt. ({g})",
  "not reachable any more": "nicht mehr erreichbar",
  "already above target": "Ziel schon erreicht",

  /* onboarding */
  "Build your weekly grid in the editor - tap a cell, type the subject.":
    "Baue deinen Wochenplan im Editor auf - Zelle antippen, Fach eintippen.",
  "or paste JSON on the timetable page": "oder JSON auf der Stundenplan-Seite einfügen",
  "Add homework and press Enter": "Hausaufgabe eintippen und Enter drücken",
  "your EPUB library - reading position, highlights and comments stay":
    "deine EPUB-Bibliothek - Leseposition, Markierungen und Kommentare bleiben gespeichert",

  /* EPUB reader */
  Reading: "Lesen",
  Library: "Bibliothek",
  "Import EPUB": "EPUB importieren",
  "Importing…": "Importiere…",
  "That is not an EPUB file.": "Das ist keine EPUB-Datei.",
  "The EPUB could not be read. Is the file intact?":
    "Die EPUB-Datei konnte nicht gelesen werden. Ist sie intakt?",
  "No books yet": "Noch keine Bücher",
  "Import an EPUB and read it right here: adjustable text, automatic reading position, highlights in four colors and comments.":
    "Importiere ein EPUB und lies es direkt hier: anpassbarer Text, automatische Leseposition, Markierungen in vier Farben und Kommentare.",
  "Remove this book? Its highlights and comments go with it.":
    "Dieses Buch entfernen? Seine Markierungen und Kommentare verschwinden mit.",
  read: "gelesen",
  "not started yet": "noch nicht angefangen",
  highlights: "Markierungen",
  Continue: "Weiterlesen",
  "Start reading": "Loslesen",
  "EPUB files stay on this device (IndexedDB) - position, highlights and comments live in your Semester data.":
    "EPUB-Dateien bleiben auf diesem Gerät (IndexedDB) - Position, Markierungen und Kommentare liegen in deinen Semester-Daten.",
  Book: "Buch",
  "Table of contents": "Inhaltsverzeichnis",
  "Highlights & comments": "Markierungen & Kommentare",
  "Reading settings": "Leseeinstellungen",
  "Smaller text": "Kleinerer Text",
  "Larger text": "Größerer Text",
  Serif: "Serif",
  Sans: "Sans",
  light: "Hell",
  sepia: "Sepia",
  dark: "Dunkel",
  "Line spacing": "Zeilenabstand",
  "This book has no chapter list.": "Dieses Buch hat kein Inhaltsverzeichnis.",
  "Select text while reading to highlight it in a color and add a comment.":
    "Markiere beim Lesen Text, um ihn farbig hervorzuheben und zu kommentieren.",
  "Opening the book…": "Buch öffnet sich…",
  "The book could not be opened.": "Das Buch konnte nicht geöffnet werden.",
  "Is the file still on this device? Re-import it from the library if in doubt.":
    "Liegt die Datei noch auf diesem Gerät? Im Zweifel in der Bibliothek neu importieren.",
  "Back to the library": "Zurück zur Bibliothek",
  "Previous page": "Vorherige Seite",
  "Next page": "Nächste Seite",
  "Edit highlight": "Markierung bearbeiten",
  Highlight: "Markieren",
  Comment: "Kommentieren",
  "Your comment…": "Dein Kommentar…",
  Gelb: "Gelb",
  Grün: "Grün",
  Blau: "Blau",
  Rosa: "Rosa",

  /* study room access + remaining copy */
  "AI is member-only right now": "Die KI ist gerade nur für Mitglieder freigeschaltet",
  "Chat and flashcard generation are limited to members of the AI team while things are in closed testing. Your documents still upload and stay synced. Ask the admin to add your account and the features unlock instantly.":
    "Chat und Lernkarten sind während der geschlossenen Testphase auf das KI-Team beschränkt. Deine Dokumente werden weiterhin hochgeladen und synchronisiert. Lass dein Konto vom Admin hinzufügen, dann schalten sich die Funktionen frei.",
  "Sign in to {feature}": "Melde dich an, um {feature}",
  "chat about your documents": "über deine Unterlagen zu chatten",
  "generate flashcards": "Lernkarten zu erstellen",
  "take quizzes": "Quizzen zu machen",
  "Use \"Sign in to sync\" in the sidebar - AI features are tied to your account so your usage and documents stay private.":
    "Nutze \"Anmelden zum Sync\" in der Seitenleiste - die KI hängt an deinem Konto, damit Nutzung und Dokumente privat bleiben.",
  document: "Dokument",
  documents: "Dokumente",
  chars: "Zeichen",

  /* grades table */
  "Punkte → Noten": "Punkte → Noten",
  "0-15 translated to 6-1 with +/-": "0–15 übersetzt in 6–1 mit +/−",
  "every whole grade spans 3 points: 3 · 2 · 1 = 5+ · 5 · 5-, 4 points (4-) still passes, 3 points (5+) does not.":
    "jede ganze Note spannt 3 Punkte auf: 3 · 2 · 1 = 5+ · 5 · 5−. Mit 4 Punkten (4−) bestehst du noch, mit 3 Punkten (5+) nicht mehr.",
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
  return (key: string) => (lang === "en" ? key : (de[key] ?? key));
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
