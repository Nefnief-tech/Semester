/* Port of `lib/utils/timetable_io.dart` (which ports the web app's
 * `src/lib/timetable.ts`) — accepts the same JSON formats and normalizes to
 * the same entry shape. */

import { TimetableEntry, timetableEntryFromJson } from '../models/types';

export const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY_ALIASES: Record<string, string> = {
  mon: 'Mon', monday: 'Mon', mo: 'Mon',
  tue: 'Tue', tues: 'Tue', tuesday: 'Tue', di: 'Tue',
  wed: 'Wed', weds: 'Wed', wednesday: 'Wed', mi: 'Wed',
  thu: 'Thu', thur: 'Thu', thursday: 'Thu', do: 'Thu', don: 'Thu',
  fri: 'Fri', friday: 'Fri', fr: 'Fri',
  sat: 'Sat', saturday: 'Sat',
  sun: 'Sun', sunday: 'Sun', so: 'Sun',
};

function normalizeDay(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return DAY_ALIASES[raw.trim().toLowerCase()] ?? null;
}

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) lower[k.toLowerCase()] = v;
  for (const k of keys) {
    const v = lower[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function pickPeriod(obj: Record<string, unknown>): number | null {
  for (const k of ['period', 'hour', 'stunde', 'lesson']) {
    const v = obj[k] ?? obj[k.toLowerCase()];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export interface ParseResult {
  entries: TimetableEntry[];
  warnings: string[];
}

function parsePeriodFromTime(time: string): number | null {
  const hour = parseInt(time.split(':')[0] ?? '', 10);
  if (Number.isNaN(hour)) return null;
  // typical German school day 08:00–17:00 → ~8 periods
  return Math.min(8, Math.max(1, hour - 7));
}

/** Accepts either a flat JSON array of lessons
 *   [{ "day": "mon", "period": 1, "time": "08:00", "subject": "Math", … }]
 * or an object grouped by day
 *   { "mon": [{ "period": 1, "subject": "Math" }], "tue": [ … ] }
 * Keys are matched case-insensitively; day names in EN or DE. */
export function parseTimetable(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new TimetableFormatError(
      "That isn't valid JSON — check for missing commas or quotes.",
    );
  }

  const warnings: string[] = [];
  const rows: Array<[unknown, Record<string, unknown>]> = [];

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i] as unknown;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        rows.push([obj.day, obj]);
      } else {
        warnings.push(`Row ${i + 1} skipped — not an object.`);
      }
    }
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (!Array.isArray(value)) {
        warnings.push(`Skipped "${key}" — the value isn't a list.`);
        continue;
      }
      for (const item of value) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          rows.push([key, item as Record<string, unknown>]);
        }
      }
    }
  } else {
    throw new TimetableFormatError(
      'Expected a JSON array of lessons or an object grouped by day.',
    );
  }

  const entries: TimetableEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const [rawDay, item] = rows[i];
    const subject = pick(item, ['subject', 'name', 'fach', 'lesson']);
    if (!subject) {
      warnings.push(`Row ${i + 1}: no subject found — skipped.`);
      continue;
    }
    const day = normalizeDay(rawDay ?? pick(item, ['day', 'tag']));
    if (!day) {
      warnings.push(`Row ${i + 1}: unknown day "${String(rawDay ?? '')}" — skipped.`);
      continue;
    }
    const time = pick(item, ['time', 'zeit', 'times', 'slot']);
    const period = pickPeriod(item) ?? (time ? parsePeriodFromTime(time) ?? i + 1 : i + 1);
    entries.push({
      day,
      period,
      time: time ?? undefined,
      subject,
      teacher: pick(item, ['teacher', 'lehrer']) ?? undefined,
      room: pick(item, ['room', 'raum']) ?? undefined,
    });
  }

  if (entries.length === 0) {
    throw new TimetableFormatError(
      'No lessons found — each entry needs at least a day and a subject.',
    );
  }

  entries.sort((a, b) => {
    const byDay = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    if (byDay !== 0) return byDay;
    return a.period - b.period;
  });
  return { entries, warnings };
}

export class TimetableFormatError extends Error {}

/** rebuilds the flat JSON form from stored entries (for the edit panel) */
export function timetableToJson(entries: TimetableEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({
      day: e.day,
      period: e.period,
      ...(e.time != null ? { time: e.time } : {}),
      subject: e.subject,
      ...(e.teacher != null ? { teacher: e.teacher } : {}),
      ...(e.room != null ? { room: e.room } : {}),
    })),
    null,
    2,
  );
}

export const EXAMPLE_TIMETABLE = `[
  { "day": "mon", "period": 1, "time": "08:00 - 08:45", "subject": "Mathematics", "teacher": "Ms. Curve", "room": "B102" },
  { "day": "mon", "period": 2, "time": "08:50 - 09:35", "subject": "Mathematics", "teacher": "Ms. Curve", "room": "B102" },
  { "day": "mon", "period": 3, "time": "09:55 - 10:40", "subject": "English", "teacher": "Mr. Words", "room": "A204" },
  { "day": "tue", "period": 1, "time": "08:00 - 08:45", "subject": "Biology", "teacher": "Ms. Cell", "room": "Lab 2" },
  { "day": "tue", "period": 3, "time": "09:55 - 10:40", "subject": "History", "teacher": "Mr. Past", "room": "C110" },
  { "day": "wed", "period": 2, "time": "08:50 - 09:35", "subject": "Spanish", "teacher": "Sr. Lopez", "room": "B004" },
  { "day": "thu", "period": 1, "time": "08:00 - 08:45", "subject": "Physics", "teacher": "Ms. Newton", "room": "Lab 1" },
  { "day": "fri", "period": 4, "time": "10:45 - 11:30", "subject": "Sports", "teacher": "Coach Run", "room": "Gym" }
]`;

export { timetableEntryFromJson };
