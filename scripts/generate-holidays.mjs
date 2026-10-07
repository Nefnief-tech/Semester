#!/usr/bin/env node
/**
 * Regenerates src/lib/holidays-data.ts from mehr-schulferien.de — their API
 * publishes the Kultusministerium school-vacation decisions per Bundesland.
 * Run whenever a new school year's dates are announced:
 *
 *   node scripts/generate-holidays.mjs 2025 2026 2027 2028
 *
 * Their period names are bare ("Herbst", "Sommer"); the generator maps them
 * to the canonical "-ferien" names and keeps ranges inclusive as delivered.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const YEARS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["2025", "2026", "2027", "2028"];

const SLUGS = {
  BW: "baden-wuerttemberg",
  BY: "bayern",
  BE: "berlin",
  BB: "brandenburg",
  HB: "bremen",
  HH: "hamburg",
  HE: "hessen",
  MV: "mecklenburg-vorpommern",
  NI: "niedersachsen",
  NW: "nordrhein-westfalen",
  RP: "rheinland-pfalz",
  SL: "saarland",
  SN: "sachsen",
  ST: "sachsen-anhalt",
  SH: "schleswig-holstein",
  TH: "thueringen",
};

const periodName = (raw) => {
  const n = String(raw || "").trim();
  if (/ferien$/i.test(n)) return n;
  // irregular stems ("Weihnachten" → Weihnachtsferien, "Ostern" → Osterferien)
  const stems = { Weihnachten: "Weihnachts", Ostern: "Oster", Pfingsten: "Pfingst", Frühjahr: "Frühjahrs" };
  return `${stems[n] ?? n}ferien`;
};

const FERIEN = {};
for (const [code, slug] of Object.entries(SLUGS)) {
  const res = await fetch(`https://www.mehr-schulferien.de/api/v2.1/federal-states/${slug}/periods`);
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  const { data } = await res.json();
  for (const row of data) {
    if (!row.is_school_vacation) continue;
    const name = periodName(row.name);
    const start = String(row.starts_on).slice(0, 10);
    const end = String(row.ends_on).slice(0, 10);
    if (end < start) continue;
    for (const y of [...new Set([Number(start.slice(0, 4)), Number(end.slice(0, 4))])]) {
      if (!YEARS.includes(String(y))) continue;
      const lo = `${y}-01-01`;
      const hi = `${y}-12-31`;
      ((FERIEN[code] ??= {})[y] ??= []).push({
        name,
        start: start < lo ? lo : start,
        end: end > hi ? hi : end,
      });
    }
  }
  await sleep(500);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// stable output: states alphabetical, years ascending, ranges by start
for (const code of Object.keys(FERIEN)) {
  for (const y of Object.keys(FERIEN[code])) {
    FERIEN[code][y].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  }
}

const header = `\
/**
 * School holidays (Schulferien) per Bundesland and calendar year.
 *
 * GENERATED FILE — regenerate with \`node scripts/generate-holidays.mjs\`
 * (source: mehr-schulferien.de API, which publishes the Kultusministerium
 * decisions). Inclusive yyyy-MM-dd dates; one range per holiday period. A
 * period spanning New Year appears in both calendar years as its halves.
 */

export interface FerienRange {
  /** capitalized period name, e.g. "Herbstferien" */
  name: string;
  /** inclusive yyyy-MM-dd */
  start: string;
  /** inclusive yyyy-MM-dd */
  end: string;
}

export const FERIEN_DATA_VERSION = "${new Date().toISOString().slice(0, 10)}";

export const FERIEN: Record<string, Record<string, FerienRange[]>> = ${JSON.stringify(FERIEN, null, 2)};
`;

writeFileSync(join(root, "src", "lib", "holidays-data.ts"), header);
console.error(`wrote src/lib/holidays-data.ts (${YEARS.join(", ")})`);
