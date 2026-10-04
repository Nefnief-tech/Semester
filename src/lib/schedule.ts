import type { TimetableEntry } from "./types";

/**
 * Time-aware helpers for the weekly timetable: what is happening now and
 * what comes next today. Ports the mobile app's "Now / Up next" logic.
 * Lessons without a "HH:MM - HH:MM" time can't be placed on the clock and
 * are skipped here.
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "08:00 - 08:45" → { start: 480, end: 525 } (minutes since midnight) */
export function parseLessonRange(time?: string): { start: number; end: number } | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

export interface PlacedLesson {
  entry: TimetableEntry;
  start: number; // minutes since midnight
  end: number;
}

export interface TimetableNow {
  /** "during" a lesson, "around" when free but lessons come before/after, "none" when the timetable says nothing about today */
  status: "during" | "around" | "none";
  current?: PlacedLesson & { endsIn: number };
  next?: PlacedLesson & { startsIn: number };
  /** today's lessons in order — lets the UI show the rest of the day */
  today: PlacedLesson[];
}

export function timetableNow(entries: TimetableEntry[], now = new Date()): TimetableNow {
  const todayName = DAY_NAMES[now.getDay()];
  const minutes = now.getHours() * 60 + now.getMinutes();

  const today = entries
    .filter((e) => e.day === todayName)
    .map((e) => ({ entry: e, range: parseLessonRange(e.time) }))
    .filter((e): e is { entry: TimetableEntry; range: { start: number; end: number } } => !!e.range)
    .map((e) => ({ entry: e.entry, start: e.range.start, end: e.range.end }))
    .sort((a, b) => a.start - b.start);

  if (today.length === 0) return { status: "none", today: [] };

  const current = today.find((l) => l.start <= minutes && minutes < l.end);
  const next = today.find((l) => l.start > minutes);

  if (current) {
    return {
      status: "during",
      current: { ...current, endsIn: current.end - minutes },
      next: next ? { ...next, startsIn: next.start - minutes } : undefined,
      today,
    };
  }
  if (next) {
    return {
      status: "around",
      next: { ...next, startsIn: next.start - minutes },
      today,
    };
  }
  return { status: "around", today };
}

/** "08:00" for minutes since midnight */
export function minutesToClock(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
