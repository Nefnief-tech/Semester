/* Data model port of the mobile app's `lib/models/types.dart` (which ports
 * the web app's `src/lib/types.ts`). JSON keys are identical so all three
 * clients read and write the same Appwrite rows interchangeably. */

/* ---------------- planner ---------------- */

export type Priority = 'low' | 'medium' | 'high';

/** semantic tone for badges and accents (Flutter's `Tone` enum) */
export type Tone = 'good' | 'ok' | 'warn' | 'bad' | 'neutral';

export function priorityFromJson(s?: string | null): Priority {
  return s === 'low' || s === 'medium' || s === 'high' ? s : 'medium';
}

export interface Subject {
  id: string;
  name: string;
  /** hex color, picked from the stationery palette */
  color: string;
}

export function subjectFromJson(j: Record<string, unknown>): Subject {
  return {
    id: String(j.id),
    name: typeof j.name === 'string' ? j.name : '',
    color: typeof j.color === 'string' ? j.color : '#3E6B4F',
  };
}

export function subjectToJson(s: Subject): Record<string, unknown> {
  return { id: s.id, name: s.name, color: s.color };
}

export interface Todo {
  id: string;
  title: string;
  notes?: string;
  /** datetime-local string, e.g. "2026-09-21T17:00"; absent when no due date */
  due?: string;
  priority: Priority;
  subjectId?: string;
  done: boolean;
  createdAt: number;
}

export function todoFromJson(j: Record<string, unknown>): Todo {
  return {
    id: String(j.id),
    title: typeof j.title === 'string' ? j.title : '',
    notes: typeof j.notes === 'string' ? j.notes : undefined,
    due: typeof j.due === 'string' ? j.due : undefined,
    priority: priorityFromJson(typeof j.priority === 'string' ? j.priority : null),
    subjectId: typeof j.subjectId === 'string' ? j.subjectId : undefined,
    done: j.done === true,
    createdAt: typeof j.createdAt === 'number' ? j.createdAt : 0,
  };
}

export function todoToJson(t: Todo): Record<string, unknown> {
  return {
    id: t.id,
    title: t.title,
    ...(t.notes != null ? { notes: t.notes } : {}),
    ...(t.due != null ? { due: t.due } : {}),
    priority: t.priority,
    ...(t.subjectId != null ? { subjectId: t.subjectId } : {}),
    done: t.done,
    createdAt: t.createdAt,
  };
}

export interface GradeEntry {
  id: string;
  subjectId?: string;
  title: string;
  /** Punkte (Oberstufe): 0–15, 15 is best */
  points: number;
  /** relative weight — typically sums to 100 within a subject */
  weight: number;
  /** yyyy-MM-dd */
  date?: string;
}

export function gradeEntryFromJson(j: Record<string, unknown>): GradeEntry {
  return {
    id: String(j.id),
    subjectId: typeof j.subjectId === 'string' ? j.subjectId : undefined,
    title: typeof j.title === 'string' ? j.title : '',
    points: typeof j.points === 'number' ? j.points : 0,
    weight: typeof j.weight === 'number' ? j.weight : 1,
    date: typeof j.date === 'string' ? j.date : undefined,
  };
}

export function gradeEntryToJson(g: GradeEntry): Record<string, unknown> {
  return {
    id: g.id,
    ...(g.subjectId != null ? { subjectId: g.subjectId } : {}),
    title: g.title,
    points: g.points,
    weight: g.weight,
    ...(g.date != null ? { date: g.date } : {}),
  };
}

export interface Homework {
  id: string;
  title: string;
  subjectId?: string;
  due?: string;
  priority: Priority;
  done: boolean;
  notes?: string;
  createdAt: number;
}

export function homeworkFromJson(j: Record<string, unknown>): Homework {
  return {
    id: String(j.id),
    title: typeof j.title === 'string' ? j.title : '',
    subjectId: typeof j.subjectId === 'string' ? j.subjectId : undefined,
    due: typeof j.due === 'string' ? j.due : undefined,
    priority: priorityFromJson(typeof j.priority === 'string' ? j.priority : null),
    done: j.done === true,
    notes: typeof j.notes === 'string' ? j.notes : undefined,
    createdAt: typeof j.createdAt === 'number' ? j.createdAt : 0,
  };
}

export function homeworkToJson(h: Homework): Record<string, unknown> {
  return {
    id: h.id,
    title: h.title,
    ...(h.subjectId != null ? { subjectId: h.subjectId } : {}),
    ...(h.due != null ? { due: h.due } : {}),
    priority: h.priority,
    done: h.done,
    ...(h.notes != null ? { notes: h.notes } : {}),
    createdAt: h.createdAt,
  };
}

export interface TimetableEntry {
  /** normalized day: Mon, Tue, Wed, Thu, Fri, Sat, Sun */
  day: string;
  /** 1-based period number */
  period: number;
  /** e.g. "08:00 - 08:45" */
  time?: string;
  subject: string;
  teacher?: string;
  room?: string;
}

export function timetableEntryFromJson(j: Record<string, unknown>): TimetableEntry {
  return {
    day: typeof j.day === 'string' ? j.day : 'Mon',
    period: typeof j.period === 'number' ? j.period : 1,
    time: typeof j.time === 'string' ? j.time : undefined,
    subject: typeof j.subject === 'string' ? j.subject : '',
    teacher: typeof j.teacher === 'string' ? j.teacher : undefined,
    room: typeof j.room === 'string' ? j.room : undefined,
  };
}

export function timetableEntryToJson(e: TimetableEntry): Record<string, unknown> {
  return {
    day: e.day,
    period: e.period,
    ...(e.time != null ? { time: e.time } : {}),
    subject: e.subject,
    ...(e.teacher != null ? { teacher: e.teacher } : {}),
    ...(e.room != null ? { room: e.room } : {}),
  };
}

export type EventType = 'study' | 'deadline' | 'exam' | 'event';

export function eventTypeFromJson(s?: string | null): EventType {
  return s === 'study' || s === 'deadline' || s === 'exam' || s === 'event' ? s : 'study';
}

export interface StudyEvent {
  id: string;
  title: string;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time?: string;
  type: EventType;
  subjectId?: string;
  notes?: string;
}

export function studyEventFromJson(j: Record<string, unknown>): StudyEvent {
  return {
    id: String(j.id),
    title: typeof j.title === 'string' ? j.title : '',
    date: typeof j.date === 'string' ? j.date : '',
    time: typeof j.time === 'string' ? j.time : undefined,
    type: eventTypeFromJson(typeof j.type === 'string' ? j.type : null),
    subjectId: typeof j.subjectId === 'string' ? j.subjectId : undefined,
    notes: typeof j.notes === 'string' ? j.notes : undefined,
  };
}

export function studyEventToJson(e: StudyEvent): Record<string, unknown> {
  return {
    id: e.id,
    title: e.title,
    date: e.date,
    ...(e.time != null ? { time: e.time } : {}),
    type: e.type,
    ...(e.subjectId != null ? { subjectId: e.subjectId } : {}),
    ...(e.notes != null ? { notes: e.notes } : {}),
  };
}

/* ---------------- AI study room ---------------- */

export type DocKind = 'pdf' | 'docx' | 'pptx' | 'txt' | 'md';

export function docKindFromJson(s?: string | null): DocKind {
  return s === 'pdf' || s === 'docx' || s === 'pptx' || s === 'txt' || s === 'md' ? s : 'txt';
}

/** metadata as the client sees it (extracted text stays on the server) */
export interface StudyDoc {
  id: string;
  name: string;
  kind: DocKind;
  size: number;
  chars: number;
  uploadedAt: number;
  /** set when the raw file was also persisted to the Appwrite storage bucket */
  bucketFileId?: string;
}

export function studyDocFromJson(j: Record<string, unknown>): StudyDoc {
  return {
    id: String(j.id),
    name: typeof j.name === 'string' ? j.name : '',
    kind: docKindFromJson(typeof j.kind === 'string' ? j.kind : null),
    size: typeof j.size === 'number' ? j.size : 0,
    chars: typeof j.chars === 'number' ? j.chars : 0,
    uploadedAt: typeof j.uploadedAt === 'number' ? j.uploadedAt : 0,
    bucketFileId: typeof j.bucketFileId === 'string' ? j.bucketFileId : undefined,
  };
}

export function studyDocToJson(d: StudyDoc): Record<string, unknown> {
  return {
    id: d.id,
    name: d.name,
    kind: d.kind,
    size: d.size,
    chars: d.chars,
    uploadedAt: d.uploadedAt,
    ...(d.bucketFileId != null ? { bucketFileId: d.bucketFileId } : {}),
  };
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export function flashcardFromJson(j: Record<string, unknown>): Flashcard {
  return {
    id: typeof j.id === 'string' ? j.id : '',
    front: typeof j.front === 'string' ? j.front : '',
    back: typeof j.back === 'string' ? j.back : '',
  };
}

export function flashcardToJson(c: Flashcard): Record<string, unknown> {
  return { id: c.id, front: c.front, back: c.back };
}

export interface Deck {
  id: string;
  title: string;
  documentIds: string[];
  createdAt: number;
  updatedAt: number;
  cards: Flashcard[];
}

export function deckFromJson(j: Record<string, unknown>): Deck {
  return {
    id: String(j.id),
    title: typeof j.title === 'string' ? j.title : 'Deck',
    documentIds: Array.isArray(j.documentIds) ? j.documentIds.map(String) : [],
    createdAt: typeof j.createdAt === 'number' ? j.createdAt : 0,
    updatedAt: typeof j.updatedAt === 'number' ? j.updatedAt : 0,
    cards: Array.isArray(j.cards)
      ? j.cards.filter((c): c is Record<string, unknown> => !!c && typeof c === 'object').map(flashcardFromJson)
      : [],
  };
}

export function deckToJson(d: Deck): Record<string, unknown> {
  return {
    id: d.id,
    title: d.title,
    documentIds: d.documentIds,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    cards: d.cards.map(flashcardToJson),
  };
}

export function deckWithCards(deck: Deck, newCards: Flashcard[]): Deck {
  return { ...deck, cards: newCards };
}

export interface ChatMessage {
  /** "user" | "assistant" */
  role: string;
  content: string;
  /** document names that were in context for this answer */
  sources?: string[];
  /** stable identity for row sync — stamped by the store on append */
  id?: string;
  /** wall-clock ms, used to order messages across devices */
  sentAt?: number;
}

export function chatMessageFromJson(j: Record<string, unknown>): ChatMessage {
  return {
    role: typeof j.role === 'string' ? j.role : 'assistant',
    content: typeof j.content === 'string' ? j.content : '',
    sources: Array.isArray(j.sources) ? j.sources.map(String) : undefined,
    id: typeof j.id === 'string' ? j.id : undefined,
    sentAt: typeof j.sentAt === 'number' ? j.sentAt : undefined,
  };
}

export function chatMessageToJson(m: ChatMessage): Record<string, unknown> {
  return {
    role: m.role,
    content: m.content,
    ...(m.sources && m.sources.length > 0 ? { sources: m.sources } : {}),
    ...(m.id != null ? { id: m.id } : {}),
    ...(m.sentAt != null ? { sentAt: m.sentAt } : {}),
  };
}

/* ---------------- school portal (device-local) ---------------- */

export interface PortalSub {
  /** 18.09.2026 */
  date: string;
  /** Fr */
  weekday: string;
  /** "1" */
  period: string;
  /** "" when nobody steps in */
  substitute: string;
  course: string;
  /** original course when it was swapped */
  courseOld?: string;
  room: string;
  info: string;
  cancelled: boolean;
}

export function portalSubFromJson(j: Record<string, unknown>): PortalSub {
  return {
    date: typeof j.date === 'string' ? j.date : '',
    weekday: typeof j.weekday === 'string' ? j.weekday : '',
    period: typeof j.period === 'string' ? j.period : '',
    substitute: typeof j.substitute === 'string' ? j.substitute : '',
    course: typeof j.course === 'string' ? j.course : '',
    courseOld: typeof j.courseOld === 'string' ? j.courseOld : undefined,
    room: typeof j.room === 'string' ? j.room : '',
    info: typeof j.info === 'string' ? j.info : '',
    cancelled: j.cancelled === true,
  };
}

export function portalSubToJson(s: PortalSub): Record<string, unknown> {
  return {
    date: s.date,
    weekday: s.weekday,
    period: s.period,
    substitute: s.substitute,
    course: s.course,
    ...(s.courseOld != null ? { courseOld: s.courseOld } : {}),
    room: s.room,
    info: s.info,
    cancelled: s.cancelled,
  };
}

export interface PortalDay {
  date: string;
  weekday: string;
  entries: PortalSub[];
}

export function portalDayFromJson(j: Record<string, unknown>): PortalDay {
  return {
    date: typeof j.date === 'string' ? j.date : '',
    weekday: typeof j.weekday === 'string' ? j.weekday : '',
    entries: Array.isArray(j.entries)
      ? j.entries
          .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
          .map(portalSubFromJson)
      : [],
  };
}

export function portalDayToJson(d: PortalDay): Record<string, unknown> {
  return { date: d.date, weekday: d.weekday, entries: d.entries.map(portalSubToJson) };
}

export interface PortalPlan {
  days: PortalDay[];
  /** the student's course codes ("Mitglied in Kursen") */
  courses: string[];
  stand?: string;
}

export function portalPlanFromJson(j: Record<string, unknown>): PortalPlan {
  return {
    days: Array.isArray(j.days)
      ? j.days
          .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
          .map(portalDayFromJson)
      : [],
    courses: Array.isArray(j.courses) ? j.courses.map(String) : [],
    stand: typeof j.stand === 'string' ? j.stand : undefined,
  };
}

export function portalPlanToJson(p: PortalPlan): Record<string, unknown> {
  return { days: p.days.map(portalDayToJson), courses: p.courses, ...(p.stand ? { stand: p.stand } : {}) };
}

/** every substitution across all days */
export function portalAllEntries(plan: PortalPlan): PortalSub[] {
  return plan.days.flatMap((d) => d.entries);
}
