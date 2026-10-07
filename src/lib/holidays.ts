import { FERIEN, type FerienRange } from "./holidays-data";

/**
 * Ferien & Feiertage per Bundesland — the German school calendar.
 *
 * Feiertage are computed locally (fixed dates plus church holidays derived
 * from Easter Sunday, the Meeus/Jones/Butcher algorithm) — exact for every
 * year, no data file needed. Schulferien come from the generated dataset in
 * holidays-data.ts (Kultusministerium decisions via ferien-api.de); without
 * a Bundesland set, or a year outside the dataset, holiday queries simply
 * return nothing.
 */

export interface Bundesland {
  code: string;
  name: string;
}

export const BUNDESLAENDER: Bundesland[] = [
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thüringen" },
];

export interface HolidayInfo {
  name: string;
  kind: "feiertag" | "ferien";
  /** ferien ranges only: inclusive end, so the UI can say "bis 31.10." */
  end?: string;
}

/* ---------------- feiertage (computed) ---------------- */

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const dayKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fixed = (year: number, month: number, day: number) => new Date(year, month - 1, day);

/** state codes sharing a regional feiertag */
const HEILIGE_DREI_KOENIGE = ["BW", "BY", "ST"];
const FRAUENTAG = ["BE", "MV"];
const WELTKINDERTAG = ["TH"];
const REFORMATIONSTAG = ["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"];
const ALLERHEILIGEN = ["BW", "BY", "NW", "RP", "SL"];
const FRONLEICHNAM = ["BW", "BY", "HE", "NW", "RP", "SL"];

const feiertagCache = new Map<string, Map<string, string>>();

/** legal holidays of one Bundesland and calendar year, keyed yyyy-MM-dd */
export function feiertage(year: number, bundesland: string): Map<string, string> {
  const cacheKey = `${year}·${bundesland}`;
  const cached = feiertagCache.get(cacheKey);
  if (cached) return cached;

  const map = new Map<string, string>();
  const put = (d: Date, name: string) => map.set(dayKeyOf(d), name);
  const easter = easterSunday(year);

  put(fixed(year, 1, 1), "Neujahr");
  put(addDays(easter, -2), "Karfreitag");
  put(addDays(easter, 1), "Ostermontag");
  put(fixed(year, 5, 1), "Tag der Arbeit");
  put(addDays(easter, 39), "Christi Himmelfahrt");
  put(addDays(easter, 50), "Pfingstmontag");
  put(fixed(year, 10, 3), "Tag der Deutschen Einheit");
  put(fixed(year, 12, 25), "1. Weihnachtstag");
  put(fixed(year, 12, 26), "2. Weihnachtstag");

  if (HEILIGE_DREI_KOENIGE.includes(bundesland)) put(fixed(year, 1, 6), "Heilige Drei Könige");
  if (FRAUENTAG.includes(bundesland)) put(fixed(year, 3, 8), "Internationaler Frauentag");
  if (WELTKINDERTAG.includes(bundesland)) put(fixed(year, 9, 20), "Weltkindertag");
  if (REFORMATIONSTAG.includes(bundesland)) put(fixed(year, 10, 31), "Reformationstag");
  if (ALLERHEILIGEN.includes(bundesland)) put(fixed(year, 11, 1), "Allerheiligen");
  if (FRONLEICHNAM.includes(bundesland)) put(addDays(easter, 60), "Fronleichnam");

  feiertagCache.set(cacheKey, map);
  return map;
}

/* ---------------- ferien (generated dataset) ---------------- */

function ferienRanges(year: number, bundesland: string): FerienRange[] {
  return FERIEN[bundesland]?.[String(year)] ?? [];
}

/** the ferien range covering a date, if any */
function ferienOn(date: Date, bundesland: string): FerienRange | null {
  const key = dayKeyOf(date);
  for (const r of ferienRanges(date.getFullYear(), bundesland))
    if (r.start <= key && key <= r.end) return r;
  return null;
}

/* ---------------- queries ---------------- */

/** what rests on this date: a legal holiday or a school holiday (or nothing) */
export function holidayInfo(date: Date, bundesland: string): HolidayInfo | null {
  if (!bundesland) return null;
  const feiertag = feiertage(date.getFullYear(), bundesland).get(dayKeyOf(date));
  if (feiertag) return { name: feiertag, kind: "feiertag" };
  const ferien = ferienOn(date, bundesland);
  if (ferien) return { name: ferien.name, kind: "ferien", end: ferien.end };
  return null;
}

/** the next ferien period starting on/after a date, looking up to 400 days ahead */
export function nextFerien(
  from: Date,
  bundesland: string,
): (FerienRange & { daysUntil: number }) | null {
  if (!bundesland) return null;
  const startKey = dayKeyOf(from);
  let best: FerienRange | null = null;
  for (let offset = 0; offset <= 400; offset += 30) {
    const year = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset).getFullYear();
    for (const r of ferienRanges(year, bundesland)) {
      if (r.end < startKey) continue;
      if (!best || r.start < best.start) best = r;
    }
    if (best) break;
  }
  if (!best) return null;
  const daysUntil = Math.round(
    (new Date(`${best.start}T12:00:00`).getTime() - new Date(`${startKey}T12:00:00`).getTime()) /
      86_400_000,
  );
  return { ...best, daysUntil: Math.max(0, daysUntil) };
}

/** true when the date is a Feiertag or ferien — the days "school is out" */
export function isSchoolOut(date: Date, bundesland: string): boolean {
  return holidayInfo(date, bundesland) !== null;
}
