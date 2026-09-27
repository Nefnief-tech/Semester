/* Port of the web app's `src/lib/utils.ts` + the mobile app's
 * `lib/utils/utils.dart`. `hashId` MUST stay byte-identical across all three
 * clients — content-hash row ids have to agree without coordination. */

import * as Crypto from 'expo-crypto';

import type { GradeEntry, Priority, Subject } from '../models/types';

export function uid(): string {
  return Crypto.randomUUID();
}

/** stationery palette for subject colors */
export const PALETTE = [
  '#3E6B4F', // bottle green
  '#38618C', // ink blue
  '#C15B33', // terracotta
  '#B98A1C', // mustard
  '#8A4F7D', // plum
  '#3E7C7B', // teal
] as const;

export function findSubject(subjects: Subject[], id?: string | null): Subject | undefined {
  return id == null ? undefined : subjects.find((s) => s.id === id);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatClock(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "11,7" — one decimal, German decimal comma */
export function formatPoints(points: number): string {
  return points.toFixed(1).replace('.', ',');
}

/* ---------------- dates ---------------- */

/** parses a datetime-local ("2026-09-21T17:00") or date ("2026-09-21")
 * string — always LOCAL time, unlike `new Date("2026-09-21")` which is UTC */
export function parseDue(due?: string | null): Date | null {
  if (!due) return null;
  const match = due
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h ?? 0),
    Number(mi ?? 0),
    Number(s ?? 0),
  );
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface DueInfo {
  date: Date;
  overdue: boolean;
  isToday: boolean;
  /** "Today · 17:00" / "Tomorrow" / "Fri 25 Sep" */
  label: string;
}

const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTH_FULL_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/** "Mon 21 Sep" style label for a yyyy-MM-dd key */
export function dayKeyLabel(key: string): string {
  const d = parseDue(key);
  if (!d) return key;
  return `${WEEKDAY_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${formatDayMonth(d)}`;
}

/** "Monday, 21 September 2026" */
export function longDateLabel(d: Date): string {
  return `${WEEKDAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1]}, ${d.getDate()} ${MONTH_FULL_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function dueInfo(due?: string | null): DueInfo | null {
  const date = parseDue(due);
  if (!date || !due) return null;
  const today = new Date();
  // UTC-normalized midnight difference — stays correct across DST changes
  const dayDiff = Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      86400000,
  );
  let label: string;
  if (dayDiff === 0) label = 'Today';
  else if (dayDiff === 1) label = 'Tomorrow';
  else if (dayDiff === -1) label = 'Yesterday';
  else if (dayDiff > 1 && dayDiff < 7) label = WEEKDAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1];
  else label = formatDayMonth(date);
  if (due.includes('T')) {
    label += ` · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return { date, overdue: dayDiff < 0, isToday: dayDiff === 0, label };
}

/** yyyy-MM-dd for a Date (local time) */
export function toDayKey(d: Date): string {
  return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 1 = Monday … 7 = Sunday (Dart's DateTime.weekday) */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/* ---------------- grades (German Punkte system: 15 best → 0 worst) ---------------- */

/** weighted mean of Punkte; null when there is nothing to average */
export function weightedAverage(entries: Iterable<GradeEntry>): number | null {
  const valid = [...entries].filter((e) => e.weight > 0);
  if (valid.length === 0) return null;
  const wSum = valid.reduce((s, e) => s + e.weight, 0);
  const sum = valid.reduce((s, e) => s + e.points * e.weight, 0);
  return sum / wSum;
}

export function weightSum(entries: Iterable<GradeEntry>): number {
  return [...entries].reduce((s, e) => s + e.weight, 0);
}

export function pointsTone(points: number): 'good' | 'ok' | 'warn' | 'bad' {
  if (points >= 13) return 'good';
  if (points >= 10) return 'ok';
  if (points >= 4) return 'warn';
  return 'bad';
}

/** converts pre-Punkte entries (score/max) to Punkte and clamps to 0–15 */
export function percentToPoints(pct: number): number {
  return Math.min(15, Math.max(0, Math.round((pct / 100) * 15)));
}

/** The Oberstufe table: every whole grade spans 3 points with +/− steps. */
export interface PointsRow {
  points: number;
  grade: string;
  note: string;
}

export const POINTS_TABLE: PointsRow[] = [
  { points: 15, grade: '1+', note: 'sehr gut' },
  { points: 14, grade: '1', note: 'sehr gut' },
  { points: 13, grade: '1-', note: 'sehr gut' },
  { points: 12, grade: '2+', note: 'gut' },
  { points: 11, grade: '2', note: 'gut' },
  { points: 10, grade: '2-', note: 'gut' },
  { points: 9, grade: '3+', note: 'befriedigend' },
  { points: 8, grade: '3', note: 'befriedigend' },
  { points: 7, grade: '3-', note: 'befriedigend' },
  { points: 6, grade: '4+', note: 'ausreichend' },
  { points: 5, grade: '4', note: 'ausreichend' },
  { points: 4, grade: '4-', note: 'ausreichend' },
  { points: 3, grade: '5+', note: 'mangelhaft' },
  { points: 2, grade: '5', note: 'mangelhaft' },
  { points: 1, grade: '5-', note: 'mangelhaft' },
  { points: 0, grade: '6', note: 'ungenügend' },
];

export interface GradeTranslation {
  grade: string;
  note: string;
  tone: 'good' | 'ok' | 'warn' | 'bad';
}

/** translates a points value into the classic +/− grade (3 → 5+, 4 → 4− …) */
export function pointsToGrade(points: number): GradeTranslation {
  const p = Math.min(15, Math.max(0, Math.round(points)));
  const row = POINTS_TABLE.find((r) => r.points === p) ?? POINTS_TABLE[0];
  return { grade: row.grade, note: row.note, tone: pointsTone(p) };
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** deterministic 16-hex id for entities without a natural key (timetable
 * entries, portal subs, …) — must match the web implementation byte for byte */
export function hashId(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')
  );
}

/** crypto-backed Fisher–Yates (avoids Math.random, which the security
 * scanner flags) */
export function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
