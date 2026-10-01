/* Eltern-Portal (art soft) fetcher + Vertretungsplan HTML parser.
 * Server-side only: performs the CSRF login dance and scrapes the plan. */

export interface PortalSub {
  date: string; // 18.09.2026
  weekday: string; // Fr
  period: string; // "1"
  substitute: string; // "" when nobody steps in
  course: string;
  courseOld?: string; // original course when it was swapped
  room: string;
  info: string;
  cancelled: boolean;
}

export interface PortalDay {
  date: string;
  weekday: string;
  entries: PortalSub[];
}

export interface PortalTest {
  /** the portal's own termine id — stable across fetches, anchors the calendar event */
  sourceId: string;
  /** as shown in the portal, e.g. "Schulaufgabe in Englisch" */
  title: string;
  /** yyyy-MM-dd (Europe/Berlin) */
  date: string;
  /** HH:mm when the portal gives a real start time, absent for all-day entries */
  time?: string;
}

export interface PortalPlan {
  days: PortalDay[];
  /** the student's course codes ("Mitglied in Kursen") */
  courses: string[];
  stand: string | null;
  /** upcoming Schulaufgaben from the termine feed (same login session) */
  tests: PortalTest[];
}

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
};

function decode(s: string) {
  return s.replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m).replace(/&#\d+;/g, " ");
}

function stripTags(s: string) {
  return s.replace(/<[^>]*>/g, " ");
}

function clean(s: string) {
  return decode(s).replace(/\s+/g, " ").trim();
}

export class PortalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalAuthError";
  }
}

/** the portal URL is user-supplied and fetched server-side — only public
 *  http(s) hosts, no localhost / private / reserved addresses */
function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("The portal URL is not a valid address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The portal URL must start with https://");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !host.includes(":")) {
    throw new Error("The portal URL needs a full hostname (e.g. evbspar.eltern-portal.org).");
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("The portal URL must point at a public host.");
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    const blocked =
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0) ||
      a >= 224;
    if (blocked) throw new Error("The portal URL must point at a public host.");
  }
  if (/^(::1|f[cd]|fe[89ab])/.test(host)) {
    throw new Error("The portal URL must point at a public host.");
  }
  return url;
}

export async function fetchPortalPlan(
  baseUrl: string,
  username: string,
  password: string,
): Promise<PortalPlan> {
  const base = assertPublicHttpUrl(baseUrl).toString().replace(/\/+$/, "");
  const jar: Record<string, string> = {};
  const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const absorb = (res: Response) => {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  };
  const UA = "SemesterApp/1.0 (personal study planner)";

  // 1. login page → CSRF token + session cookie
  const r1 = await fetch(`${base}/`, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  absorb(r1);
  const loginHtml = await r1.text();
  const csrf =
    loginHtml.match(/name='csrf' value='([^']*)'/)?.[1] ??
    loginHtml.match(/name="csrf" value="([^"]*)"/)?.[1];
  if (!csrf) throw new Error("Could not find the login form (wrong portal URL?).");

  // 2. credentials → session
  const r2 = await fetch(`${base}/includes/project/auth/login.php`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
      "user-agent": UA,
    },
    body: new URLSearchParams({ csrf, username, password, go_to: "" }).toString(),
    signal: AbortSignal.timeout(20000),
  });
  absorb(r2);

  // 3. the plan (a logged-out fetch lands back on the login form)
  const r3 = await fetch(`${base}/service/vertretungsplan`, {
    headers: { cookie: cookieHeader(), "user-agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  absorb(r3);
  const html = await r3.text();
  if (r3.status !== 200 || html.includes("form-signin")) {
    throw new PortalAuthError("Portal rejected the login — check URL, email and password.");
  }

  // 4. the termine feed (same session) — schulaufgaben ride along on every
  // plan fetch. A missing/malformed feed must never fail the plan itself.
  let tests: PortalTest[] = [];
  try {
    const r4 = await fetch(`${base}/api/ws_get_termine.php`, {
      headers: { cookie: cookieHeader(), "user-agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    absorb(r4);
    const feed = await r4.text();
    if (r4.status === 200 && !feed.includes("form-signin")) {
      tests = parsePortalTests(JSON.parse(feed));
    }
  } catch {
    tests = [];
  }

  return { ...parseVertretungsplan(html), tests };
}

export function parseVertretungsplan(html: string): Omit<PortalPlan, "tests"> {
  const days: PortalDay[] = [];

  const blockRe =
    /<div class='list bold full_width text_center'>([^<]+)<\/div>\s*<table[^>]*>([\s\S]*?)<\/table>/g;
  const rowRe = /<tr class='liste_(?:grau|weiss)'>([\s\S]*?)<\/tr>/g;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;

  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(html)) !== null) {
    const header = decode(block[1]);
    const dm = header.match(/(\w{2})\.,\s*(\d{2}\.\d{2}\.\d{4})/);
    const weekday = dm?.[1] ?? "";
    const date = dm?.[2] ?? header.trim();

    const entries: PortalSub[] = [];
    let row: RegExpExecArray | null;
    while ((row = rowRe.exec(block[2])) !== null) {
      const cells: string[] = [];
      let cell: RegExpExecArray | null;
      cellRe.lastIndex = 0;
      while ((cell = cellRe.exec(row[1])) !== null) cells.push(cell[1]);
      if (cells.length < 5) continue;

      const period = decode(cells[0]).replace(/\./g, "").trim();
      const substitute = decode(stripTags(cells[1])).replace(/\s+/g, " ").trim();

      // course cell: `<span line-through>old</span> new` when a course was swapped
      let courseOld: string | undefined;
      let courseHtml = cells[2];
      const span = courseHtml.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
      if (span) {
        courseOld = clean(span[1]);
        courseHtml = courseHtml.replace(/<span[^>]*>[\s\S]*?<\/span>/i, " ");
      }
      const course = clean(courseHtml);
      const room = decode(stripTags(cells[3])).replace(/\s+/g, " ").trim();
      const info = decode(stripTags(cells[4])).replace(/\s+/g, " ").trim();

      if (!course && !substitute && !info) continue;
      entries.push({
        date,
        weekday,
        period,
        substitute,
        course,
        courseOld: courseOld || undefined,
        room,
        info,
        cancelled: /entf/i.test(info),
      });
    }
    days.push({ date, weekday, entries });
  }

  // the student's own course codes
  const courses: string[] = [];
  const cm = html.match(/Mitglied in Kursen[\s\S]*?<td valign='top'>([\s\S]*?)<\/td>/);
  if (cm) {
    for (const part of cm[1].split(/<br\s*\/?>/i)) {
      const code = clean(part);
      if (code) courses.push(code);
    }
  }

  const stand = decode(html.match(/Stand:&nbsp;([^<</]+)</)?.[1] ?? "").trim() || null;

  return { days, courses, stand };
}

/* ---------------- Schulaufgaben (termine feed) ----------------
 * The portal's own calendar is fed by /api/ws_get_termine.php — a flat JSON
 * list of every visible termin (holidays, exams, …) with epoch-ms start/end.
 * The "Schulaufgaben" list page is just the filtered view of this feed, so
 * we filter here: titles like "Schulaufgabe in Englisch", or "SA in …" in
 * the short form. Dates are resolved in Europe/Berlin — the portal serves
 * Bavarian schools and servers may run in any timezone. */

const TEST_TITLE_RE = /schulaufgabe/i;
const TEST_TITLE_SHORT_RE = /\bSA\b/;

/** yyyy-MM-dd / HH:mm for an epoch-ms timestamp, resolved in school time */
function berlinParts(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
}

export function parsePortalTests(json: unknown): PortalTest[] {
  const feed = json as { success?: number | string; result?: unknown } | null;
  if (!feed || Number(feed.success) !== 1 || !Array.isArray(feed.result)) return [];

  const today = berlinParts(Date.now()).date;
  const tests: PortalTest[] = [];
  for (const raw of feed.result) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const title = typeof row.title === "string" ? decode(row.title).replace(/\s+/g, " ").trim() : "";
    const titleShort =
      typeof row.title_short === "string" ? decode(row.title_short).replace(/\s+/g, " ").trim() : "";
    if (!title && !titleShort) continue;
    if (!TEST_TITLE_RE.test(title) && !TEST_TITLE_SHORT_RE.test(titleShort)) continue;

    const startMs = Number(row.start);
    if (!Number.isFinite(startMs) || startMs <= 0) continue;
    const { date, time } = berlinParts(startMs);
    if (date < today) continue; // upcoming only — past exams stay out of the calendar

    const sourceId = typeof row.id === "string" || typeof row.id === "number"
      ? String(row.id).trim()
      : "";
    tests.push({
      sourceId: sourceId || `${date}|${title}`,
      title: title || titleShort,
      date,
      time: time === "00:00" || time === "24:00" ? undefined : time,
    });
  }
  return tests.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}
