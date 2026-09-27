/* Sync engine — port of the mobile app's `lib/appwrite/sync.dart`, restated
 * on the web app's REST row format (src/lib/auth/sync.ts).
 *
 * EVERYTHING syncs as rows in Appwrite tables (subjects · todos · homeworks ·
 * grades · events · timetable_entries · chat_messages · decks · flashcards ·
 * study_selection · portal_entries · portal_courses). One row per entity,
 * rowId = the entity id (or a content hash for id-less entities):
 *
 *   push  = diff the local store against the last-synced row digests and
 *           upsert changed rows / soft-delete (deleted=true) removed rows
 *   pull  = fetch all rows of the user and merge — rows with pending local
 *           edits win, remote rows otherwise, deleted rows remove locally
 *   realtime = single-row events through the same merge
 *
 * A device can therefore never wipe data it hasn't seen: with no local
 * entities and no stored digests the push phase has nothing to do, so a
 * fresh device's first sync is a pure pull. */

import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AppwriteError,
  RowData,
  appwriteConfigured,
  clearSessionSecret,
  connectRealtime,
  createEmailPasswordSession,
  createAccount,
  createMfaChallenge,
  createMfaRecoveryCodes,
  deleteCurrentSession,
  deletePushTarget,
  disconnectRealtime,
  getCurrentUser,
  getCurrentUserStrict,
  getMfaRecoveryCodes,
  invalidateJwtCache,
  listMfaFactors,
  loadPersistedSession,
  requestPasswordRecovery,
  restListRows,
  restSoftDeleteRow,
  restUpsertRow,
  ROW_TABLES,
  sendVerificationEmail,
  updateMfa,
  updateMfaChallenge,
} from './appwrite';
import { AuthUser, useAuthStore, useSyncMetaStore } from '../stores/auth_store';
import { useEventsStore } from '../stores/events_store';
import { useGradesStore } from '../stores/grades_store';
import { useHomeworkStore } from '../stores/homework_store';
import { PortalSub, portalSubFromJson } from '../models/types';
import { portalCourseRowId, portalSubRowId, usePortalStore } from '../stores/portal_store';
import { useSettingsStore } from '../stores/settings_store';
import { useStudyroomStore } from '../stores/studyroom_store';
import { useSubjectsStore } from '../stores/subjects_store';
import { timetableRowId, useTimetableStore } from '../stores/timetable_store';
import { useTodosStore } from '../stores/todos_store';
import { hashId } from '../utils/utils';

const PUSH_DEBOUNCE_MS = 1200;
const MAX_CHAT_MESSAGES = 120;

export class MfaRequiredError extends Error {
  emailFactor: boolean;
  totpFactor: boolean;
  constructor({ emailFactor = true, totpFactor = false }: { emailFactor?: boolean; totpFactor?: boolean }) {
    super('Two-factor authentication is required.');
    this.emailFactor = emailFactor;
    this.totpFactor = totpFactor;
  }
}

function isMfaFactorsError(e: unknown): boolean {
  return (
    e instanceof AppwriteError &&
    (e.type === 'user_more_factors_required' ||
      (e.code === 401 && e.message.includes('more factors')))
  );
}

/* ---------------- row adapters ---------------- */

interface RowEntity {
  id: string;
  row: Record<string, unknown>;
}

interface RowAdapter {
  storeKey: string;
  table: string;
  /** local entities as (rowId, row-payload) pairs */
  list: () => RowEntity[];
  /** merge a cloud row payload into the store */
  applyRow: (id: string, row: Record<string, unknown>) => void;
  /** drop a row from the store (cloud tombstone) */
  removeRow: (id: string) => void;
}

const ROW_STORE_KEYS = Object.keys(ROW_TABLES);

async function rowDigest(row: Record<string, unknown>): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(row));
}

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v : '';
}

function optStr(row: Record<string, unknown>, key: string): string | undefined {
  const v = str(row, key);
  return v === '' ? undefined : v;
}

function bool(row: Record<string, unknown>, key: string): boolean {
  return row[key] === true;
}

function num(row: Record<string, unknown>, key: string, fallback = 0): number {
  const v = row[key];
  return typeof v === 'number' ? v : fallback;
}

function parseJsonArray(v: unknown): string[] {
  if (typeof v !== 'string') return [];
  try {
    const parsed = JSON.parse(v) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseSources(v: unknown): string[] | undefined {
  const arr = parseJsonArray(v);
  return arr.length > 0 ? arr : undefined;
}

const ROW_STORES: Record<string, RowAdapter> = {
  subjects: {
    storeKey: 'subjects',
    table: 'subjects',
    list: () =>
      useSubjectsStore.getState().subjects.map((s) => ({
        id: s.id,
        row: { name: s.name, color: s.color },
      })),
    applyRow: (id, row) =>
      useSubjectsStore.getState().upsertOne({
        id,
        name: str(row, 'name'),
        color: str(row, 'color') || '#3E6B4F',
      }),
    removeRow: (id) => useSubjectsStore.getState().removeOne(id),
  },
  todos: {
    storeKey: 'todos',
    table: 'todos',
    list: () =>
      useTodosStore.getState().todos.map((t) => ({
        id: t.id,
        row: {
          title: t.title,
          notes: t.notes ?? '',
          due: t.due ?? '',
          priority: t.priority,
          subjectId: t.subjectId ?? '',
          done: t.done,
          createdAt: t.createdAt,
        },
      })),
    applyRow: (id, row) =>
      useTodosStore.getState().upsertOne({
        id,
        title: str(row, 'title'),
        notes: optStr(row, 'notes'),
        due: optStr(row, 'due'),
        priority: (str(row, 'priority') as 'low' | 'medium' | 'high') || 'medium',
        subjectId: optStr(row, 'subjectId'),
        done: bool(row, 'done'),
        createdAt: num(row, 'createdAt'),
      }),
    removeRow: (id) => useTodosStore.getState().removeOne(id),
  },
  homework: {
    storeKey: 'homework',
    table: 'homeworks',
    list: () =>
      useHomeworkStore.getState().homeworks.map((h) => ({
        id: h.id,
        row: {
          title: h.title,
          notes: h.notes ?? '',
          due: h.due ?? '',
          priority: h.priority,
          subjectId: h.subjectId ?? '',
          done: h.done,
          createdAt: h.createdAt,
        },
      })),
    applyRow: (id, row) =>
      useHomeworkStore.getState().upsertOne({
        id,
        title: str(row, 'title'),
        notes: optStr(row, 'notes'),
        due: optStr(row, 'due'),
        priority: (str(row, 'priority') as 'low' | 'medium' | 'high') || 'medium',
        subjectId: optStr(row, 'subjectId'),
        done: bool(row, 'done'),
        createdAt: num(row, 'createdAt'),
      }),
    removeRow: (id) => useHomeworkStore.getState().removeOne(id),
  },
  grades: {
    storeKey: 'grades',
    table: 'grades',
    list: () =>
      useGradesStore.getState().entries.map((g) => ({
        id: g.id,
        row: {
          subjectId: g.subjectId ?? '',
          title: g.title,
          points: Math.trunc(g.points),
          weight: g.weight,
          date: g.date ?? '',
        },
      })),
    applyRow: (id, row) =>
      useGradesStore.getState().upsertOne({
        id,
        subjectId: optStr(row, 'subjectId'),
        title: str(row, 'title'),
        points: Math.trunc(num(row, 'points')),
        weight: num(row, 'weight', 1),
        date: optStr(row, 'date'),
      }),
    removeRow: (id) => useGradesStore.getState().removeOne(id),
  },
  events: {
    storeKey: 'events',
    table: 'events',
    list: () =>
      useEventsStore.getState().events.map((e) => ({
        id: e.id,
        row: {
          title: e.title,
          date: e.date,
          time: e.time ?? '',
          type: e.type,
          subjectId: e.subjectId ?? '',
          notes: e.notes ?? '',
        },
      })),
    applyRow: (id, row) =>
      useEventsStore.getState().upsertOne({
        id,
        title: str(row, 'title'),
        date: str(row, 'date'),
        time: optStr(row, 'time'),
        type: (str(row, 'type') as 'study' | 'deadline' | 'exam' | 'event') || 'study',
        subjectId: optStr(row, 'subjectId'),
        notes: optStr(row, 'notes'),
      }),
    removeRow: (id) => useEventsStore.getState().removeOne(id),
  },
  timetable: {
    storeKey: 'timetable',
    // entries have no natural id — the row id is the content hash
    table: 'timetable_entries',
    list: () =>
      useTimetableStore.getState().entries.map((e) => ({
        id: timetableRowId(e),
        row: {
          day: e.day,
          period: e.period,
          time: e.time ?? '',
          subject: e.subject,
          teacher: e.teacher ?? '',
          room: e.room ?? '',
        },
      })),
    applyRow: (id, row) => {
      void id;
      useTimetableStore.getState().upsertEntry({
        day: str(row, 'day') || 'Mon',
        period: Math.trunc(num(row, 'period', 1)),
        time: optStr(row, 'time'),
        subject: str(row, 'subject'),
        teacher: optStr(row, 'teacher'),
        room: optStr(row, 'room'),
      });
    },
    removeRow: (id) => useTimetableStore.getState().removeEntry(id),
  },
  chat: {
    storeKey: 'chat',
    table: 'chat_messages',
    list: () =>
      useStudyroomStore
        .getState()
        .chat.filter((m) => m.id != null)
        .slice(0, MAX_CHAT_MESSAGES)
        .map((m) => ({
          id: m.id!,
          row: {
            role: m.role,
            content: m.content,
            sources: JSON.stringify(m.sources ?? []),
            sentAt: m.sentAt ?? 0,
          },
        })),
    applyRow: (id, row) =>
      useStudyroomStore.getState().upsertChatMessage({
        id,
        role: str(row, 'role') === 'user' ? 'user' : 'assistant',
        content: str(row, 'content'),
        sources: parseSources(row.sources),
        sentAt: typeof row.sentAt === 'number' ? row.sentAt : undefined,
      }),
    removeRow: (id) => useStudyroomStore.getState().removeChatMessage(id),
  },
  decks: {
    storeKey: 'decks',
    table: 'decks',
    list: () =>
      useStudyroomStore.getState().decks.map((d) => ({
        id: d.id,
        row: {
          title: d.title,
          documentIds: JSON.stringify(d.documentIds),
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        },
      })),
    applyRow: (id, row) => {
      const room = useStudyroomStore.getState();
      // rows carry no cards — keep the locally known ones when merging
      const existing = room.decks.find((d) => d.id === id);
      room.upsertDeck({
        id,
        title: str(row, 'title') || 'Deck',
        documentIds: parseJsonArray(row.documentIds),
        createdAt: num(row, 'createdAt'),
        updatedAt: num(row, 'updatedAt'),
        cards: existing?.cards ?? [],
      });
    },
    removeRow: (id) => useStudyroomStore.getState().removeDeckSilently(id),
  },
  flashcards: {
    storeKey: 'flashcards',
    table: 'flashcards',
    list: () =>
      useStudyroomStore
        .getState()
        .decks.flatMap((d) =>
          d.cards.map((c) => ({
            id: c.id,
            row: { deckId: d.id, front: c.front, back: c.back ?? '' },
          })),
        ),
    applyRow: (id, row) => {
      const room = useStudyroomStore.getState();
      const deckId = str(row, 'deckId');
      // a card can arrive before its deck row — keep it attachable
      if (!room.decks.some((d) => d.id === deckId)) {
        const now = Date.now();
        room.upsertDeck({ id: deckId, title: 'Deck', documentIds: [], createdAt: now, updatedAt: now, cards: [] });
      }
      room.upsertCard(deckId, {
        id,
        front: str(row, 'front'),
        back: str(row, 'back'),
      });
    },
    removeRow: (id) => {
      const room = useStudyroomStore.getState();
      const deck = room.decks.find((d) => d.cards.some((c) => c.id === id));
      if (deck) room.removeCard(deck.id, id);
    },
  },
  selection: {
    storeKey: 'selection',
    table: 'study_selection',
    list: () =>
      useStudyroomStore.getState().selectedDocIds.map((d) => ({
        id: hashId(`sel|${d}`),
        row: { documentId: d },
      })),
    applyRow: (_id, row) => {
      const documentId = str(row, 'documentId');
      if (documentId) useStudyroomStore.getState().upsertSelection(documentId);
    },
    removeRow: (id) => {
      const room = useStudyroomStore.getState();
      const docId = room.selectedDocIds.find((d) => hashId(`sel|${d}`) === id);
      if (docId) room.removeSelection(docId);
    },
  },
  portalEntries: {
    storeKey: 'portalEntries',
    table: 'portal_entries',
    list: () =>
      (usePortalStore.getState().data?.days ?? []).flatMap((day) =>
        day.entries.map((e) => ({
          id: portalSubRowId(e),
          row: {
            date: e.date,
            weekday: e.weekday ?? '',
            period: e.period ?? '',
            course: e.course ?? '',
            courseOld: e.courseOld ?? '',
            substitute: e.substitute ?? '',
            room: e.room ?? '',
            info: e.info ?? '',
            cancelled: e.cancelled ?? false,
          },
        })),
      ),
    applyRow: (_id, row) => {
      const sub: PortalSub = portalSubFromJson(row);
      if (sub.date) usePortalStore.getState().upsertSub(sub);
    },
    removeRow: (id) => usePortalStore.getState().removeSub(id),
  },
  portalCourses: {
    storeKey: 'portalCourses',
    table: 'portal_courses',
    list: () =>
      (usePortalStore.getState().data?.courses ?? []).map((course) => ({
        id: portalCourseRowId(course),
        row: { course },
      })),
    applyRow: (_id, row) => {
      const course = str(row, 'course');
      if (course) usePortalStore.getState().upsertCourse(course);
    },
    removeRow: (id) => usePortalStore.getState().removeCourse(id),
  },
};

/* ---------------- push (diff) ---------------- */

const rowPushTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/** set while the sync engine writes remote data into the stores, so those
 * writes don't schedule pushes back to the cloud */
export let applyingRemote = false;

export function scheduleRowSync(storeKey: string): void {
  if (applyingRemote) return;
  const { user, status } = useAuthStore.getState();
  if (status !== 'signed-in' || !user) return;
  clearTimeout(rowPushTimers[storeKey]);
  rowPushTimers[storeKey] = setTimeout(() => {
    const { user: u, status: st } = useAuthStore.getState();
    if (st === 'signed-in' && u) void syncRows(storeKey, u);
  }, PUSH_DEBOUNCE_MS);
}

/** diff local store vs last-synced digests → upserts + soft-deletes */
async function syncRows(storeKey: string, user: AuthUser): Promise<void> {
  const def = ROW_STORES[storeKey];
  const meta = useSyncMetaStore.getState();
  const digests = { ...(meta.rowDigests[storeKey] ?? {}) };

  const current = def.list();
  const currentDigests: Record<string, string> = {};
  for (const entity of current) {
    const digest = await rowDigest(entity.row);
    currentDigests[entity.id] = digest;
    if (digests[entity.id] !== digest) {
      await restUpsertRow(def.table, entity.id, { ...entity.row, userId: user.id }, user.id);
      // record the pushed digest — otherwise the entity re-pushes on every
      // sync, each push echoing a realtime event → endless churn
      digests[entity.id] = digest;
    }
  }

  // rows the cloud knows that vanished locally → soft-delete
  for (const id of Object.keys(digests)) {
    if (currentDigests[id] === undefined) {
      await restSoftDeleteRow(def.table, id, user.id).catch(() => {
        // row never existed / already gone — fine
      });
      delete digests[id];
    }
  }

  useSyncMetaStore.getState().setRowDigests(storeKey, digests);
}

/* ---------------- pull (merge) ---------------- */

/** merge pulled rows into a store; locally-changed rows win */
async function mergeRows(storeKey: string, rows: Array<RowData & { $id: string }>): Promise<void> {
  const def = ROW_STORES[storeKey];
  const digests = { ...(useSyncMetaStore.getState().rowDigests[storeKey] ?? {}) };
  const current = def.list();
  const byId = new Map(current.map((e) => [e.id, e]));

  const wasApplying = applyingRemote;
  applyingRemote = true;
  try {
    for (const row of rows) {
      const id = String(row.$id);
      if (row.deleted === true) {
        if (byId.has(id)) def.removeRow(id);
        delete digests[id];
        continue;
      }
      const local = byId.get(id);
      if (local) {
        const localDigest = await rowDigest(local.row);
        if (localDigest !== digests[id]) continue; // pending local edit wins
      }
      def.applyRow(id, row);
      const applied = def.list().find((e) => e.id === id);
      digests[id] = await rowDigest(applied ? applied.row : row);
    }
  } finally {
    applyingRemote = wasApplying;
  }
  useSyncMetaStore.getState().setRowDigests(storeKey, digests);
}

async function pullRows(storeKey: string, user: AuthUser): Promise<void> {
  const def = ROW_STORES[storeKey];
  const rows = await restListRows(def.table, user.id);
  await mergeRows(storeKey, rows);

  // rows our digests claim are synced but the cloud no longer returns were
  // hard-deleted server-side — drop their digests and re-push, otherwise
  // the stale digests would suppress the upload forever (full pulls only:
  // single realtime events can't tell whether other rows still exist)
  const digests = { ...(useSyncMetaStore.getState().rowDigests[storeKey] ?? {}) };
  const localIds = new Set(def.list().map((e) => e.id));
  const cloudIds = new Set(rows.map((row) => String(row.$id)));
  let vanished = false;
  for (const id of Object.keys(digests)) {
    if (!cloudIds.has(id) && localIds.has(id)) {
      delete digests[id];
      vanished = true;
    }
  }
  if (vanished) {
    useSyncMetaStore.getState().setRowDigests(storeKey, digests);
    scheduleRowSync(storeKey);
  }
}

/* ---------------- reconcile ---------------- */

let reconcileInFlight: Promise<void> = Promise.resolve();

async function runReconcile(user: AuthUser): Promise<void> {
  const auth = useAuthStore.getState();
  const failed: string[] = [];
  for (const key of ROW_STORE_KEYS) {
    try {
      await syncRows(key, user);
      await pullRows(key, user);
    } catch (e) {
      failed.push(key);
      console.warn(`[sync] row store ${key} failed:`, e);
    }
  }
  if (failed.length > 0) {
    auth.setSyncError(
      `sync incomplete — ${failed.join(', ')} could not be synced; check your connection and tap Sync now`,
    );
    scheduleRetryLoop();
    return;
  }
  useAuthStore.getState().setSynced(Date.now());
}

/** serializes reconciles — startup, resume and "Sync now" must never race
 * each other (a concurrent run flips `applyingRemote` mid-loop) */
export function reconcile(user: AuthUser): Promise<void> {
  reconcileInFlight = reconcileInFlight.then(async () => {
    const { status, user: current } = useAuthStore.getState();
    if (status !== 'signed-in' || current?.id !== user.id) return;
    try {
      await runReconcile(user);
    } catch (e) {
      useAuthStore.getState().setSyncError(String(e));
    }
  });
  return reconcileInFlight;
}

let retryTimer: ReturnType<typeof setInterval> | undefined;

/** while the sync is incomplete, keep retrying every 30 s — flaky-DNS
 * windows come and go, and the app should heal on its own */
function scheduleRetryLoop(): void {
  if (retryTimer) return;
  let ticks = 0;
  retryTimer = setInterval(() => {
    ticks++;
    const { status, syncError, user } = useAuthStore.getState();
    if (status !== 'signed-in' || !syncError || !user || ticks > 120) {
      clearInterval(retryTimer);
      retryTimer = undefined;
      return;
    }
    void reconcile(user);
  }, 30_000);
}

/** pulls the cloud state again — called when the app returns to the
 * foreground, so changes missed while suspended are not lost */
export async function resync(): Promise<void> {
  const { user, status } = useAuthStore.getState();
  if (status !== 'signed-in' || !user) return;
  await reconcile(user);
}

/** "Sync now" — full round-trip */
export async function syncNow(): Promise<void> {
  const { user, status } = useAuthStore.getState();
  if (status !== 'signed-in' || !user) return;
  await reconcile(user);
}

/** The portal plan is a FULL SNAPSHOT: one fetch replaces the whole thing.
 * Called after every successful portal fetch — the fetched plan is
 * authoritative; push it, then tombstone every other live row of this user
 * (web parity: reconcilePortalSnapshot in src/lib/auth/sync.ts). */
export async function reconcilePortalSnapshot(): Promise<void> {
  const { user, status } = useAuthStore.getState();
  if (status !== 'signed-in' || !user) return;
  for (const key of ['portalEntries', 'portalCourses']) {
    const def = ROW_STORES[key];
    try {
      const current = def.list();
      const currentIds = new Set<string>();
      const digests: Record<string, string> = {};
      for (const entity of current) {
        currentIds.add(entity.id);
        digests[entity.id] = await rowDigest(entity.row);
        await restUpsertRow(def.table, entity.id, { ...entity.row, userId: user.id }, user.id);
      }
      const cloudRows = await restListRows(def.table, user.id);
      for (const row of cloudRows) {
        if (row.deleted === true) continue;
        if (!currentIds.has(String(row.$id))) {
          await restSoftDeleteRow(def.table, String(row.$id), user.id).catch(() => {});
        }
      }
      useSyncMetaStore.getState().setRowDigests(key, digests);
    } catch (e) {
      console.warn(`[sync] portal snapshot ${key} failed:`, e);
    }
  }
}

/* ---------------- realtime ---------------- */

function startRealtime(user: AuthUser): void {
  const channels = ROW_STORE_KEYS.map(
    (key) => `databases.semester.tables.${ROW_TABLES[key]}.rows`,
  );
  connectRealtime(channels, (payload, events) => {
    try {
      const { user: current, status } = useAuthStore.getState();
      if (status !== 'signed-in' || current?.id !== user.id) return;
      if (payload.userId !== user.id) return; // another user's row
      const event = events[0] ?? '';
      if (!event.includes('/tables/')) return;
      for (const [storeKey, table] of Object.entries(ROW_TABLES)) {
        if (event.includes(`/tables/${table}/rows`)) {
          void mergeRows(storeKey, [{ ...payload, $id: String(payload.$id ?? payload.id ?? '') }]);
          return;
        }
      }
    } catch {
      // a malformed event must never crash the app
    }
  });
}

/* ---------------- store subscriptions ---------------- */

let subscribed = false;

function subscribeStores(): void {
  if (subscribed) return;
  subscribed = true;
  useSubjectsStore.subscribe(() => scheduleRowSync('subjects'));
  useTodosStore.subscribe(() => scheduleRowSync('todos'));
  useHomeworkStore.subscribe(() => scheduleRowSync('homework'));
  useGradesStore.subscribe(() => scheduleRowSync('grades'));
  useEventsStore.subscribe(() => scheduleRowSync('events'));
  useTimetableStore.subscribe(() => scheduleRowSync('timetable'));
  useStudyroomStore.subscribe(() => {
    // one store backs four row collections — schedule each diff
    scheduleRowSync('chat');
    scheduleRowSync('decks');
    scheduleRowSync('flashcards');
    scheduleRowSync('selection');
  });
  usePortalStore.subscribe(() => {
    scheduleRowSync('portalEntries');
    scheduleRowSync('portalCourses');
  });
}

/* ---------------- init / auth actions ---------------- */

const USER_ID_KEY = 'semester.appwriteuserid';
const USER_EMAIL_KEY = 'semester.appwriteuseremail';

async function persistUserId(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(USER_ID_KEY, user.id);
  await AsyncStorage.setItem(USER_EMAIL_KEY, user.email);
}

async function storedIdentity(): Promise<{ id: string; email: string } | null> {
  try {
    const id = await AsyncStorage.getItem(USER_ID_KEY);
    const email = await AsyncStorage.getItem(USER_EMAIL_KEY);
    if (!id) return null;
    return { id, email: email ?? '' };
  } catch {
    return null;
  }
}

function webAppBase(): string {
  const base = useSettingsStore.getState().serverUrl.trim();
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/** restores the Appwrite session (if any) and reconciles — run once on
 * startup, AFTER the stores have rehydrated */
export async function initSync(): Promise<void> {
  const auth = useAuthStore.getState();
  if (!appwriteConfigured()) {
    auth.setAuth(null, 'unconfigured');
    return;
  }
  auth.setAuth(null, 'loading');

  const savedSecret = await loadPersistedSession();
  // distinguish "no valid session" (401) from network failures — a flaky
  // DNS window at startup must not sign the app out
  let user: AuthUser | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      user = await getCurrentUserStrict();
      lastError = null;
      break;
    } catch (e) {
      if (isMfaFactorsError(e)) {
        lastError = null; // genuinely no valid session
        break;
      }
      lastError = e;
    }
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }

  if (!user && lastError && savedSecret) {
    // network failed with a stored session — stay signed in optimistically
    // using the persisted identity; reconcile retries will surface errors
    console.warn('[sync] init: network failed, optimistic sign-in');
    const stored = await storedIdentity();
    user = { id: stored?.id ?? '', email: stored?.email ?? '', name: stored?.email ?? '', emailVerified: false, mfa: false };
  }

  if (!user) {
    useAuthStore.getState().setAuth(null, 'signed-out');
    return;
  }
  await persistUserId(user);
  useAuthStore.getState().setAuth(user, 'signed-in');
  subscribeStores();
  startRealtime(user);
  await reconcile(user);

  // flaky networks: if the first reconcile failed, keep retrying — an
  // empty-looking app that never pulls is worse than a delay
  for (let attempt = 0; attempt < 4; attempt++) {
    const { status, syncError } = useAuthStore.getState();
    if (status !== 'signed-in' || !syncError) return;
    await new Promise((r) => setTimeout(r, 10_000));
    if (useAuthStore.getState().status !== 'signed-in') return;
    await reconcile(user);
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  try {
    await createEmailPasswordSession(email, password);
  } catch (e) {
    if (isMfaFactorsError(e)) {
      throw await mfaRequiredError();
    }
    throw e;
  }
  // a pending-MFA session authenticates only MFA calls — the profile read
  // is what tells us the difference
  let user: AuthUser | null = null;
  try {
    user = await getCurrentUserStrict();
  } catch (e) {
    if (isMfaFactorsError(e)) throw await mfaRequiredError();
    user = null;
  }
  if (!user) {
    // belt & suspenders failed — the session exists but the profile doesn't load
    useAuthStore.getState().setAuth(
      { id: '', email, name: email, emailVerified: false, mfa: false },
      'signed-in',
    );
    subscribeStores();
    return;
  }
  await persistUserId(user);
  useAuthStore.getState().setAuth(user, 'signed-in');
  subscribeStores();
  startRealtime(user);
  await reconcile(user);
}

async function mfaRequiredError(): Promise<MfaRequiredError> {
  let emailFactor = true;
  let totpFactor = false;
  try {
    const f = await listMfaFactors();
    emailFactor = f.email;
    totpFactor = f.totp;
  } catch {}
  return new MfaRequiredError({ emailFactor, totpFactor });
}

/* ---------------- email 2FA (MFA) ---------------- */

/** starts a challenge — for the email factor this sends the code */
export async function startMfaChallenge(factor: string): Promise<string> {
  return createMfaChallenge(factor);
}

/** completes the pending sign-in with the emailed (or TOTP / recovery) code */
export async function confirmMfaSignIn(challengeId: string, otp: string): Promise<void> {
  await updateMfaChallenge(challengeId, otp);
  const user = await getCurrentUserStrict();
  await persistUserId(user);
  useAuthStore.getState().setAuth(user, 'signed-in');
  subscribeStores();
  startRealtime(user);
  await reconcile(user);
}

/** drops the pending session when the user abandons the 2FA step */
export async function cancelMfaSignIn(): Promise<void> {
  try {
    await deleteCurrentSession();
  } catch {}
}

/** toggles two-factor for the signed-in account */
export async function setMfaEnabled(enabled: boolean): Promise<void> {
  await updateMfa(enabled);
  await refreshUser();
}

/** recovery codes for the enabled account — generates the first set on demand */
export async function getOrCreateRecoveryCodes(): Promise<string[]> {
  try {
    const existing = await getMfaRecoveryCodes();
    if (existing && existing.length > 0) return existing;
  } catch {
    // none generated yet
  }
  return createMfaRecoveryCodes();
}

export async function signUp(name: string, email: string, password: string): Promise<void> {
  await createAccount(name, email, password);
  await signIn(email, password);
  // the session is fresh — send the verification mail right away; SMTP
  // misconfig or rate limits must never fail the signup itself
  try {
    await sendVerificationEmail(webAppBase());
  } catch {}
}

/* ---------------- email verification + password recovery ----------------
 * Sending a verification needs the signed-in session; confirming is a public
 * endpoint and recovery create/complete are guest-callable. The emails point
 * at the Semester web app (/verify, /recover) — the link completes there. */

export async function sendVerification(): Promise<void> {
  await sendVerificationEmail(webAppBase());
}

export async function requestRecovery(email: string): Promise<void> {
  await requestPasswordRecovery(email, webAppBase());
}

/** re-fetches the profile — refreshes the verified badge after the user
 * confirmed the link (possibly in another browser) */
export async function refreshUser(): Promise<void> {
  const { status } = useAuthStore.getState();
  if (status !== 'signed-in') return;
  const user = await getCurrentUser();
  if (user) useAuthStore.getState().setAuth(user, 'signed-in');
}

/** signs out; local data deliberately stays on the device */
export async function signOut(): Promise<void> {
  await deleteCurrentSession();
  disconnectRealtime();
  await clearSessionSecret();
  await AsyncStorage.removeItem(USER_ID_KEY);
  await AsyncStorage.removeItem(USER_EMAIL_KEY);
  invalidateJwtCache();
  useAuthStore.getState().setAuth(null, 'signed-out');
}
