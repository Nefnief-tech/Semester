"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";

/**
 * Documentation at /docs — Semester-styled long-form page: paper background,
 * Fraunces section heads, mono labels, a sticky section sidebar with
 * scroll-spy, and real content (setup, features, self-hosting). Scoped
 * under `.docs` with its own light/dark variables that follow the app theme.
 */

const DOCS_CSS = `
.docs {
  --d-bg: #f5f2ea; --d-panel: #fdfcf8; --d-line: #e0dacb; --d-line-soft: #eae5d8;
  --d-ink: #26221b; --d-soft: #6b6455; --d-faint: #a49b88; --d-accent: #31633f;
  --d-accent-soft: #e2eadd; --d-amber: #8a6a10;
  background: var(--d-bg); color: var(--d-ink);
  font-family: var(--font-instrument), system-ui, sans-serif;
  font-size: 16px; line-height: 1.65;
  -webkit-font-smoothing: antialiased; min-height: 100dvh;
}
.docs ::selection { background: var(--d-accent); color: var(--d-bg); }
.dark .docs {
  --d-bg: #17150f; --d-panel: #211e17; --d-line: #353025; --d-line-soft: #2b261d;
  --d-ink: #ece6d6; --d-soft: #a29a88; --d-faint: #7a7260; --d-accent: #8fb99a;
  --d-accent-soft: #253528; --d-amber: #d9b95c;
  color-scheme: dark;
}
.docs a { color: inherit; }
.docs .wrap { max-width: 1200px; margin: 0 auto; padding: 0 28px; }
.docs .mono { font-family: var(--font-plex), monospace; }

.docs .nav {
  position: sticky; top: 0; z-index: 40;
  background: color-mix(in srgb, var(--d-bg) 82%, transparent);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--d-line-soft);
}
.docs .nav-inner { display: flex; align-items: center; gap: 24px; height: 62px; }
.docs .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-family: var(--font-fraunces), Georgia, serif; font-weight: 600; font-size: 19px; letter-spacing: -0.02em; }
.docs .brand img { width: 24px; height: 24px; border-radius: 7px; }
.docs .nav-links { display: flex; align-items: center; gap: 22px; margin-left: auto; }
.docs .nav-links a { text-decoration: none; font-size: 14px; color: var(--d-soft); transition: color .15s ease; }
.docs .nav-links a:hover { color: var(--d-ink); }
.docs .nav-cta {
  text-decoration: none; font-size: 14px; font-weight: 500;
  background: var(--d-accent); color: #f5f2ea; border-radius: 999px; padding: 8px 18px;
  transition: background-color .2s ease;
}
.docs .nav-cta:hover { background: var(--d-ink); color: var(--d-bg); }
@media (prefers-reduced-motion: no-preference) {
  @media (min-width: 721px) {
    .dark .docs .nav-cta { color: #17150f; }
  }
}
.docs .nav-cta { color: #f5f2ea; }
.dark .docs .nav-cta { background: var(--d-accent); color: #17150f; }

.docs .layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 56px; padding: 44px 0 110px; }
@media (max-width: 900px) { .docs .layout { grid-template-columns: 1fr; gap: 20px; } }

.docs .toc { position: sticky; top: 86px; align-self: start; max-height: calc(100dvh - 110px); overflow-y: auto; }
@media (max-width: 900px) {
  .docs .toc { position: static; max-height: none; display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; }
}
.docs .toc .group { margin-bottom: 22px; }
@media (max-width: 900px) { .docs .toc .group { margin-bottom: 0; display: contents; } }
.docs .toc .g-label { font-family: var(--font-plex), monospace; font-size: 9.5px; letter-spacing: .18em; text-transform: uppercase; color: var(--d-faint); margin-bottom: 8px; }
@media (max-width: 900px) { .docs .toc .g-label { display: none; } }
.docs .toc a {
  display: block; text-decoration: none; font-size: 13.5px; color: var(--d-soft);
  padding: 4.5px 10px; border-radius: 8px;
  transition: color .15s ease, background-color .15s ease;
}
@media (max-width: 900px) {
  .docs .toc a { border: 1px solid var(--d-line); border-radius: 999px; padding: 5px 12px; white-space: nowrap; }
}
.docs .toc a:hover { color: var(--d-ink); }
.docs .toc a.active { color: var(--d-accent); background: var(--d-accent-soft); font-weight: 500; }
@media (max-width: 900px) { .docs .toc a.active { border-color: var(--d-accent); } }

.docs article { max-width: 76ch; }
.docs section { padding: 44px 0 8px; scroll-margin-top: 90px; }
.docs section:first-child { padding-top: 0; }
.docs h1 { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: clamp(34px, 4vw, 52px); letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 10px; }
.docs .lede { color: var(--d-soft); font-size: 17px; max-width: 60ch; margin: 0 0 20px; }
.docs h2 { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: 27px; letter-spacing: -0.015em; margin: 0 0 16px; padding-top: 26px; border-top: 1px solid var(--d-line-soft); scroll-margin-top: 90px; }
.docs h3 { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: 18.5px; margin: 26px 0 8px; }
.docs p { margin: 0 0 14px; color: var(--d-ink); }
.docs .muted { color: var(--d-soft); font-size: 14.5px; }
.docs ul { margin: 0 0 14px; padding-left: 20px; color: var(--d-ink); }
.docs li { margin-bottom: 6px; }
.docs li::marker { color: var(--d-accent); }
.docs strong { font-weight: 600; }
.docs code {
  font-family: var(--font-plex), monospace; font-size: .85em;
  background: var(--d-accent-soft); color: var(--d-accent);
  border-radius: 6px; padding: 1.5px 6px;
}
.docs pre {
  background: var(--d-panel); border: 1px solid var(--d-line); border-radius: 14px;
  padding: 16px 18px; overflow-x: auto; margin: 0 0 18px;
}
.docs pre code { background: none; padding: 0; color: var(--d-ink); font-size: 12.5px; line-height: 1.6; }
.docs table { border-collapse: collapse; margin: 0 0 18px; font-size: 14px; width: 100%; }
.docs th { text-align: left; font-family: var(--font-plex), monospace; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--d-soft); font-weight: 500; padding: 8px 14px 8px 0; border-bottom: 1px solid var(--d-line); }
.docs td { padding: 8px 14px 8px 0; border-bottom: 1px solid var(--d-line-soft); vertical-align: top; }
.docs tr:last-child td { border-bottom: 0; }
.docs .tip {
  border: 1px solid color-mix(in srgb, var(--d-accent) 30%, var(--d-line));
  background: var(--d-accent-soft); border-radius: 14px; padding: 14px 18px; margin: 0 0 18px;
  font-size: 14.5px;
}
.docs .tip .k { font-family: var(--font-plex), monospace; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--d-accent); display: block; margin-bottom: 4px; }
.docs kbd {
  font-family: var(--font-plex), monospace; font-size: 11px;
  border: 1px solid var(--d-line); border-bottom-width: 2px; border-radius: 6px;
  background: var(--d-panel); padding: 1px 6px;
}

.docs .footer { border-top: 1px solid var(--d-line-soft); padding: 26px 0 46px; color: var(--d-soft); font-size: 13px; }
.docs .foot-inner { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.docs .foot-right { margin-left: auto; display: flex; gap: 20px; }
.docs .foot-inner a { text-decoration: none; }
.docs .foot-inner a:hover { color: var(--d-ink); }
`;

const NAV_SECTIONS: Array<{ group: string; items: Array<{ id: string; label: string }> }> = [
  {
    group: "Start",
    items: [
      { id: "about", label: "What is Semester" },
      { id: "setup", label: "Setup" },
      { id: "portal", label: "School portal" },
    ],
  },
  {
    group: "Daily use",
    items: [
      { id: "tasks", label: "Tasks & homework" },
      { id: "timetable", label: "Timetable" },
      { id: "grades", label: "Grades" },
      { id: "calendar", label: "Calendar" },
      { id: "study", label: "Study room" },
      { id: "push", label: "Push & digest" },
    ],
  },
  {
    group: "Under the hood",
    items: [
      { id: "sync", label: "Sync & offline" },
      { id: "self-host", label: "Self-hosting" },
      { id: "shortcuts", label: "Shortcuts" },
    ],
  },
];

export default function DocsPage() {
  const [active, setActive] = useState("about");

  /* scroll-spy: the section closest to the top of the viewport wins */
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".docs section[id]"));
    if (sections.length === 0) return;
    const pick = () => {
      let current = sections[0].id;
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= 140) current = s.id;
      }
      setActive(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    return () => window.removeEventListener("scroll", pick);
  }, []);

  const brand = (
    <img
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='96' fill='%2331633f'/%3E%3Cg stroke='%23f5f2ea' stroke-width='34' stroke-linecap='round'%3E%3Cline x1='256' y1='128' x2='256' y2='384'/%3E%3Cline x1='143.6' y1='192' x2='368.4' y2='320'/%3E%3Cline x1='143.6' y1='320' x2='368.4' y2='192'/%3E%3C/g%3E%3Ccircle cx='256' cy='256' r='40' fill='%23f5f2ea'/%3E%3C/svg%3E"
      alt=""
    />
  );

  return (
    <div className="docs">
      <style dangerouslySetInnerHTML={{ __html: DOCS_CSS }} />

      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" href="/landing">
            {brand}
            Semester.
          </Link>
          <div className="nav-links">
            <Link href="/landing">Overview</Link>
            <a href="https://github.com/Nefnief-tech/study">GitHub</a>
            <ThemeToggle />
            <Link className="nav-cta" href="/">
              Open the app
            </Link>
          </div>
        </div>
      </nav>

      <div className="wrap layout">
        <aside className="toc">
          {NAV_SECTIONS.map(({ group, items }) => (
            <div className="group" key={group}>
              <p className="g-label">{group}</p>
              {items.map(({ id, label }) => (
                <a key={id} href={`#${id}`} className={active === id ? "active" : ""}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </aside>

        <article>
          <section id="about">
            <h1>Documentation</h1>
            <p className="lede">
              Everything Semester can do and how it fits together: setup, daily
              use, what syncs where, and how to self-host the whole stack.
            </p>
            <p>
              Semester is a study desk for school: your timetable, tasks,
              homework, grades, calendar and study material in one app, on the
              web and on your phone. It talks to your school&apos;s
              Eltern-Portal for substitute plans and upcoming Schulaufgaben,
              syncs everything through your own Appwrite project, and never
              sends your portal login anywhere but your own server.
            </p>
            <p className="muted">
              New here? The <a href="#setup"><strong>Setup</strong></a> chapter
              takes you from empty desk to running app in about one afternoon.
            </p>
          </section>

          <section id="setup">
            <h2>Setup</h2>
            <h3>1 · Subjects</h3>
            <p>
              Subjects are the shared vocabulary of the whole app: tasks,
              homework, grades and calendar entries all link to them. Add them
              once on the Overview&apos;s setup card (comma separated) and every
              tool offers them from then on.
            </p>
            <h3>2 · Timetable</h3>
            <p>
              The timetable is a JSON list you paste once on the{" "}
              <Link href="/timetable">timetable page</Link>. Each entry is one
              lesson slot:
            </p>
            <pre>
              <code>{`[
  { "day": "mon", "period": 1, "time": "08:00 - 08:45",
    "subject": "Mathematik", "teacher": "Herr Maier", "room": "B1" },
  { "day": "mon", "period": "3 - 4", "subject": "Sport", "room": "Gym" }
]`}</code>
            </pre>
            <ul>
              <li>
                <code>day</code> is <code>mon</code> to <code>sun</code> (German
                abbreviations work too), <code>period</code> is a number or a
                range for double lessons.
              </li>
              <li>
                <code>time</code> is optional but unlocks the live Now / Next
                card on the overview and the current-lesson highlight in the
                grid.
              </li>
            </ul>
            <h3>3 · Everything else</h3>
            <p>
              Tasks, homework, grades and calendar entries are added in the app
              itself. The setup card on the overview walks you through all
              three steps and ticks itself off as you go.
            </p>
          </section>

          <section id="portal">
            <h2>School portal</h2>
            <p>
              On the timetable page you can connect your Eltern-Portal account.
              After that, every visit (or a press of <em>Fetch now</em>) logs in
              and pulls two things:
            </p>
            <ul>
              <li>
                <strong>The substitute plan</strong> — cancellations and
                substitutes appear directly in your grid, and the overview
                shows the current lesson with what changed.
              </li>
              <li>
                <strong>Upcoming Schulaufgaben</strong> — they are added to your
                calendar as exam entries and to your tasks automatically, so
                the countdown and the daily digest know about them.
              </li>
            </ul>
            <div className="tip">
              <span className="k">Privacy</span>
              Portal credentials are stored only on the device you enter them
              on. They are sent once per fetch to your own server, which
              performs the login. What reaches the cloud is the parsed plan
              without any credentials, so your phone&apos;s digest can read it.
            </div>
          </section>

          <section id="tasks">
            <h2>Tasks &amp; homework</h2>
            <p>
              Both share the same queue mechanics but stay separate lists:
              tasks are your general to-dos, homework is what teachers
              assigned. Every entry has an optional due date and time, a
              priority and a subject.
            </p>
            <ul>
              <li>
                The overview shows one Today pile with quick-add, plus the
                queue that follows.
              </li>
              <li>
                The Tasks page groups open work by urgency: Overdue, Today,
                Tomorrow, This week, Later, Someday.
              </li>
              <li>
                Quick-capture from anywhere with{" "}
                <kbd>⌘K</kbd>/<kbd>Ctrl K</kbd>: type a title, choose task,
                homework or exam, press Enter.
              </li>
              <li>
                Due dates land on the calendar by themselves, overdue items are
                marked red.
              </li>
            </ul>
          </section>

          <section id="timetable">
            <h2>Timetable</h2>
            <p>
              The grid shows one column per day and one row per period. When
              the portal is connected, cancelled lessons are struck through
              with a red chip and substituted lessons show the substitute and
              room in amber. Today&apos;s column is tinted, and the lesson
              happening right now is outlined.
            </p>
            <p className="muted">
              Substitutions are matched to the grid by weekday and period, so
              an unusual subject code in the plan still lands on the right
              lesson.
            </p>
          </section>

          <section id="grades">
            <h2>Grades</h2>
            <p>
              Semester uses the Bavarian Punkte system (15 best to 0 worst).
              Every grade has a weight, and subject averages as well as your
              overall average are weighted means:
            </p>
            <pre>
              <code>{`average = Σ(points × weight) / Σ(weight)`}</code>
            </pre>
            <p>
              Averages are shown as Punkte plus the classic Note scale badge
              (15 → &quot;1+&quot;, down to 0 → &quot;6&quot;). The subject list
              on the overview shows each average as a bar, tinted by tone.
            </p>
          </section>

          <section id="calendar">
            <h2>Calendar</h2>
            <p>
              Month and week views combine four kinds of entries: study
              sessions, deadlines, exams and events. Task and homework due
              dates appear automatically, so the calendar is never out of sync
              with your lists. Click a day to add an entry, click an entry to
              edit or delete it.
            </p>
          </section>

          <section id="study">
            <h2>Study room</h2>
            <p>
              The study room turns your material into answers: upload PDFs,
              slides, DOCX or plain notes, tick the documents that should be
              used as context, then chat (answers cite the exact page) or
              generate flashcard decks from the material.
            </p>
            <p>
              AI features are currently limited to members of the AI team while
              they are in closed testing; uploads and syncing work for every
              signed-in account.
            </p>
            <p className="muted">
              Any OpenAI-compatible provider works. Configure it in{" "}
              <code>.env.local</code> via <code>AI_API_KEY</code>,{" "}
              <code>AI_BASE_URL</code> and <code>AI_MODEL</code>, or use the
              preset shortcuts <code>ZAI_API_KEY</code>,{" "}
              <code>OPENAI_API_KEY</code> or <code>DEEPSEEK_API_KEY</code>.
            </p>
          </section>

          <section id="push">
            <h2>Push &amp; digest</h2>
            <p>
              Three scheduled pushes a day keep your phone current (times in
              CEST, one hour earlier in winter):
            </p>
            <table>
              <thead>
                <tr>
                  <th>Push</th>
                  <th>Content</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Tomorrow</td>
                  <td>
                    Next day&apos;s lessons from the timetable, including
                    cancellations and substitutes from the mirrored portal
                    plan.
                  </td>
                </tr>
                <tr>
                  <td>Due soon</td>
                  <td>
                    Overdue homework and tasks, or due today/tomorrow, sorted
                    by date with subject names.
                  </td>
                </tr>
                <tr>
                  <td>Next 7 days</td>
                  <td>
                    Exams, deadlines and events of the coming week, exams
                    first.
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="muted">
              Empty digests are never sent, and re-running a push the same day
              never double-sends.
            </p>
          </section>

          <section id="sync">
            <h2>Sync &amp; offline</h2>
            <p>
              Everything syncs as structured rows through your own Appwrite
              project: one row per task, grade, lesson, document. Row ids are
              deterministic, so web and phone agree without coordination, and
              edits made offline win locally until their push lands.
            </p>
            <ul>
              <li>Without an account, everything lives in the browser and nothing leaves the device.</li>
              <li>Signing in syncs your existing data up; signing out leaves it on the device.</li>
              <li>Deleted rows are tombstoned, never hard-deleted, so a device that was offline can never wipe data it hasn&apos;t seen.</li>
            </ul>
          </section>

          <section id="self-host">
            <h2>Self-hosting</h2>
            <p>
              The whole stack runs where you want it: the Next.js app as a
              standalone Docker container, Appwrite Cloud (or self-hosted
              Appwrite) for data, and the push functions as scheduled Appwrite
              functions.
            </p>
            <pre>
              <code>{`git clone https://github.com/Nefnief-tech/study.git
cd study
npm install

# .env.local
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<your project id>
AI_API_KEY=<optional: your AI provider key>

npm run build
docker compose up -d --build     # serves on port 8899

appwrite push functions          # deploy the digest + homework pushes`}</code>
            </pre>
            <p className="muted">
              The Appwrite project needs the tables the app creates at runtime
              (subjects, todos, homeworks, grades, events, timetable_entries,
              portal tables, …), the <code>study-files</code> storage bucket for
              uploads, and push credentials for the digest. See the repository
              README for the full checklist.
            </p>
          </section>

          <section id="shortcuts">
            <h2>Shortcuts</h2>
            <table>
              <thead>
                <tr>
                  <th>Keys</th>
                  <th>What happens</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd>
                  </td>
                  <td>
                    Command palette: jump to any page, or type a title to
                    create a task, homework or exam; toggle theme, force sync.
                  </td>
                </tr>
                <tr>
                  <td>
                    <kbd>Enter</kbd> in quick-add
                  </td>
                  <td>Commits the task into today&apos;s pile.</td>
                </tr>
                <tr>
                  <td>
                    <kbd>Esc</kbd>
                  </td>
                  <td>Closes any overlay (palette, forms).</td>
                </tr>
              </tbody>
            </table>
          </section>
        </article>
      </div>

      <div className="wrap">
        <footer className="footer">
          <div className="foot-inner">
            <Link className="brand" href="/landing">
              {brand}
              Semester.
            </Link>
            <span>Open source and self-hostable.</span>
            <div className="foot-right">
              <a href="https://github.com/Nefnief-tech/study">GitHub</a>
              <a href="https://github.com/Nefnief-tech/study/releases">Releases</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
