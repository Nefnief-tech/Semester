import { currentLang } from "./i18n";
import type { Subject } from "./types";
import { toDayKey } from "./utils";

/**
 * Universal quick capture: one typed line ("Mathe Blatt 14 bis Fr um 17") becomes
 * { title, due, subjectId }. German first, English tolerated — weekdays and
 * relative days are pulled out of the text, subjects are matched against the
 * user's own list. Two-letter weekday forms ("Fr") only count after bis/am/zum
 * so ordinary words never turn into dates.
 */

export interface QuickEntry {
  title: string;
  /** datetime-local "yyyy-MM-ddTHH:mm" */
  due?: string;
  subjectId?: string;
  /** matched bits for the palette hint, e.g. ["Fr 26.09.", "Mathe"] */
  match: string[];
}

const WEEKDAY_NUM: Record<string, number> = {
  // JS getDay(): 0 = Sunday
  sonntag: 0, sunday: 0,
  montag: 1, monday: 1,
  dienstag: 2, tuesday: 2, tues: 2,
  mittwoch: 3, wednesday: 3,
  donnerstag: 4, thursday: 4, thurs: 4,
  freitag: 5, friday: 5,
  samstag: 6, saturday: 6,
};
const WEEKDAY_SHORT: Record<string, number> = {
  so: 0, sun: 0, mo: 1, mon: 1, di: 2, tue: 2, tues: 2, mi: 3, wed: 3,
  do: 4, thu: 4, fri: 5, fr: 5, sa: 6, sat: 6,
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** next occurrence of a weekday (0-6), today included */
function nextWeekday(from: Date, day: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
  return d;
}

/** Damerau-Levenshtein edit distance — a swapped letter pair counts once */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const d: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * distance between a typed word and a subject name, tolerant of length
 * differences: each side may compare against the other's matching prefix
 * ("mate" scores against "math…", the first 4 letters of Mathematik)
 */
function fuzzyDistance(word: string, name: string): number {
  return Math.min(
    levenshtein(word, name.slice(0, word.length)),
    levenshtein(word.slice(0, name.length), name),
  );
}

export function parseQuickEntry(
  raw: string,
  subjects: Subject[],
  now = new Date(),
): QuickEntry {
  let text = ` ${raw.trim()} `;
  const match: string[] = [];
  let date: Date | null = null;
  let time: string | null = null;

  const consume = (m: RegExpMatchArray) => {
    text = text.replace(m[0], " ");
    return m[0].trim();
  };

  // relative days
  if (!date) {
    const rel: Array<[RegExp, number, string]> = [
      [/\s(heute|today)\s/i, 0, "heute"],
      [/\s(morgen|tomorrow)\s/i, 1, "morgen"],
      [/\s(übermorgen)\s/i, 2, "übermorgen"],
    ];
    for (const [re, offset] of rel) {
      const m = text.match(re);
      if (m) {
        date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        consume(m);
        break;
      }
    }
  }

  // "in N Tagen" / "in N days"
  if (!date) {
    const m = text.match(/\sin (\d{1,2}) (tagen|tag|days|day)\b/i);
    if (m) {
      date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Number(m[1]));
      consume(m);
    }
  }

  // full weekday names stand alone; 2-letter forms need bis/am/zum before them
  if (!date) {
    const full = text.match(/\s(bis\s|am\s|zum\s)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s/i);
    const short = !full
      ? text.match(/\s(bis|am|zum)\s(mo|di|mi|do|fr|sa|so|mon|tue|tues|thu|fri|sat|sun)\s/i)
      : null;
    const m = full ?? short;
    if (m) {
      const word = (full ? m[2] : m[2]).toLowerCase();
      const day = full ? WEEKDAY_NUM[word] : WEEKDAY_SHORT[word];
      if (day !== undefined) {
        date = nextWeekday(now, day);
        // rebuild the consumed span including the inner space ("bis Fr ")
        const prefix = m[1] ? `${m[1].trimEnd()} ` : "";
        consume({ ...m, 0: `${prefix}${m[2]} ` });
      }
    }
  }

  // explicit date: 25.09. / 25.09.2026 (German order first — the audience)
  if (!date) {
    const m = text.match(/\s(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\s/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      let year = m[3] ? Number(m[3]) : now.getFullYear();
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        date = new Date(year, month - 1, day);
        consume(m);
      }
    }
  }

  // time: "um 17:00" or "17:00 Uhr"
  const tm = text.match(/\sum\s(\d{1,2}):(\d{2})\s/i) ?? text.match(/\s(\d{1,2}):(\d{2})\suhr\s/i);
  if (tm) {
    const h = Number(tm[1]);
    const min = Number(tm[2]);
    if (h <= 23 && min <= 59) {
      time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      consume(tm);
    }
  }

  // dangling prepositions after consuming the date part
  text = text.replace(/\s(bis|am|um|zum)\s*$/i, " ");
  const title = text.replace(/\s+/g, " ").trim();

  // subject match against the user's own list — exact first, then prefix
  // ("Mathe" → "Mathematik"), then fuzzy: the closest subject within a small
  // edit budget wins ("math", "mate", even a typo'd "mthae")
  let subjectId: string | undefined;
  let matchedName: string | undefined;
  let matchedWord: string | undefined;
  let bestScore = Infinity;
  for (const word of title.split(/[\s,.!?;:()]+/)) {
    if (word.length < 3) continue;
    const w = word.toLowerCase();
    for (const s of subjects) {
      const full = s.name.toLowerCase();
      if (full.length < 3) continue;
      // compare against the whole name and each of its words ("Kunst und Kultur")
      for (const n of [full, ...full.split(/\s+/)]) {
        if (n.length < 3) continue;
        let score = Infinity;
        if (n === w) score = 0;
        else if (n.startsWith(w) || w.startsWith(n)) score = 1;
        else {
          const d = fuzzyDistance(w, n);
          const minLen = Math.min(w.length, n.length);
          // 4+ chars: 1 edit per 4 letters; 3 chars: a single typo still counts
          const allowed = minLen >= 4 ? Math.floor(minLen / 4) : minLen === 3 ? 1 : 0;
          if (d <= allowed) score = 2 + d;
        }
        if (score < bestScore) {
          bestScore = score;
          subjectId = s.id;
          matchedName = s.name;
          matchedWord = word;
        }
      }
    }
  }
  if (subjectId && matchedName) match.push(matchedName);

  // a recognized subject word leaves the title — it lives in the subject tag
  let finalTitle = title;
  if (subjectId && matchedWord) {
    finalTitle = title
      .replace(new RegExp(`(^|\\W)${escapeRegex(matchedWord)}(?=\\W|$)`, "i"), "$1")
      .replace(/^[\s,.;:!?]+/, "")
      .replace(/[\s,.;:!?]+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    // nothing left ("Mathe bis Fr") → the subject name becomes the title
    if (!finalTitle) finalTitle = matchedName ?? title;
  }

  if (date) {
    const label = date.toLocaleDateString(currentLang() === "de" ? "de-DE" : "en-GB", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    });
    match.unshift(label);
  }

  return {
    title: finalTitle,
    due: date ? `${toDayKey(date)}${time ? `T${time}` : ""}` : undefined,
    subjectId,
    match,
  };
}
