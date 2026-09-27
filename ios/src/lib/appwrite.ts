/* Appwrite powers auth + cloud sync — plain REST over fetch, the same wire
 * format the web app's `src/lib/auth/sync.ts` uses (the JS SDK's browser
 * cookie auth doesn't apply here).
 *
 * Cloud 2.2 specifics baked in:
 *   · `X-Appwrite-Project` on EVERY request — omit it and the API answers
 *     401 general_access_forbidden regardless of a valid JWT
 *   · row queries are JSON objects, one per `queries[]` param
 *   · row PUT carries `data` + `permissions`; JWT-authenticated calls may
 *     set user-scoped permissions (session-cookie calls may not)
 *   · session secrets travel in the `X-Fallback-Cookies` RESPONSE header —
 *     the base64 envelope value doubles as the `X-Appwrite-Session` header
 *
 * Endpoint + project id are public client values (same project as the web
 * app — same database, same tables). Override at bundle time with
 * EXPO_PUBLIC_APPWRITE_ENDPOINT / EXPO_PUBLIC_APPWRITE_PROJECT_ID. */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthUser } from '../stores/auth_store';

export const APPWRITE_ENDPOINT =
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '6aac46e3001a9ef65b25';

export const DATABASE_ID = 'semester';
export const STORAGE_BUCKET_ID = 'study-files';

export const ROW_TABLES: Record<string, string> = {
  subjects: 'subjects',
  todos: 'todos',
  homework: 'homeworks',
  grades: 'grades',
  events: 'events',
  timetable: 'timetable_entries',
  chat: 'chat_messages',
  decks: 'decks',
  flashcards: 'flashcards',
  selection: 'study_selection',
  portalEntries: 'portal_entries',
  portalCourses: 'portal_courses',
};

export function appwriteConfigured(): boolean {
  return APPWRITE_ENDPOINT.length > 0 && APPWRITE_PROJECT_ID.length > 0;
}

/** pins every outgoing request to the configured Appwrite endpoint host —
 * app code must never be able to send these credentials anywhere else */
function assertAppwriteEndpoint(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Refusing non-HTTP(S) Appwrite request: ${parsed.protocol}`);
  }
  const expected = new URL(APPWRITE_ENDPOINT).host;
  if (parsed.host !== expected) {
    throw new Error(`Refusing Appwrite request to unexpected host: ${parsed.host}`);
  }
}

/* ---------------- session secret persistence ---------------- */

const SESSION_KEY = 'semester.appwritesession';

let sessionSecret: string | null = null;

export async function loadPersistedSession(): Promise<string | null> {
  if (sessionSecret) return sessionSecret;
  try {
    sessionSecret = await AsyncStorage.getItem(SESSION_KEY);
  } catch {
    sessionSecret = null;
  }
  return sessionSecret;
}

async function persistSessionSecret(secret: string): Promise<void> {
  sessionSecret = secret;
  await AsyncStorage.setItem(SESSION_KEY, secret);
}

export async function clearSessionSecret(): Promise<void> {
  sessionSecret = null;
  await AsyncStorage.removeItem(SESSION_KEY);
}

/* ---------------- core request helper ---------------- */

export class AppwriteError extends Error {
  code: number;
  type: string;
  constructor(code: number, type: string, message: string) {
    super(message);
    this.code = code;
    this.type = type;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** session | jwt | none */
  auth?: 'session' | 'jwt' | 'none';
  /** mint a fresh JWT once on 401 (a stale cached token is the classic cause) */
  refreshJwtOn401?: boolean;
}

let jwtCache: { token: string; at: number } | null = null;

export function invalidateJwtCache(): void {
  jwtCache = null;
}

async function fetchJwt(): Promise<string | null> {
  try {
    if (!jwtCache || Date.now() - jwtCache.at > 10 * 60 * 1000) {
      const res = await appwriteRequest('/account/jwts', { method: 'POST', body: {}, auth: 'session' });
      if (!res.ok) return null;
      const json = (await res.json()) as { jwt?: string };
      if (!json.jwt) return null;
      jwtCache = { token: json.jwt, at: Date.now() };
    }
    return jwtCache.token;
  } catch {
    return null;
  }
}

/** Authorization header carrying a short-lived Appwrite JWT (cached ~10 min),
 * used to authenticate app → Semester-server API calls; null when signed out */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const jwt = await fetchJwt();
  return jwt ? { authorization: `Bearer ${jwt}` } : {};
}

async function appwriteRequest(path: string, opts: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'X-Appwrite-Project': APPWRITE_PROJECT_ID,
    'content-type': 'application/json',
  };
  if (opts.auth === 'session' && sessionSecret) {
    headers['X-Appwrite-Session'] = sessionSecret;
  }
  if (opts.auth === 'jwt') {
    const jwt = await fetchJwt();
    if (!jwt) throw new AppwriteError(401, 'user_unauthorized', 'no valid session for a JWT');
    // Cloud 2.2 requires BOTH header forms (parity with the web client —
    // X-Appwrite-JWT alone 403s on row routes)
    headers['X-Appwrite-JWT'] = jwt;
    headers.authorization = `Bearer ${jwt}`;
  }
  const doFetch = () => {
    assertAppwriteEndpoint(`${APPWRITE_ENDPOINT}${path}`);
    return fetch(`${APPWRITE_ENDPOINT}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      // authenticate via headers ONLY — iOS's shared cookie jar would attach
      // the login session cookie to JWT calls and Appwrite 2.3 403s on
      // "JWT and cookie used in the same request"
      credentials: 'omit',
    });
  };
  let res = await doFetch();
  if (res.status === 401 && opts.refreshJwtOn401) {
    invalidateJwtCache();
    const jwt = await fetchJwt();
    if (jwt) {
      headers['X-Appwrite-JWT'] = jwt;
      headers.authorization = `Bearer ${jwt}`;
      assertAppwriteEndpoint(`${APPWRITE_ENDPOINT}${path}`);
      res = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        credentials: 'omit',
      });
    }
  }
  return res;
}

async function errorFrom(res: Response): Promise<AppwriteError> {
  let type = 'general_error';
  let message = `${res.status} ${res.statusText}`;
  try {
    const json = (await res.json()) as { type?: string; message?: string };
    if (json.type) type = json.type;
    if (json.message) message = json.message;
  } catch {
    // non-JSON error body
  }
  return new AppwriteError(res.status, type, message);
}

/* ---------------- account ---------------- */

function userFromJson(j: Record<string, unknown>): AuthUser {
  const email = typeof j.email === 'string' ? j.email : '';
  return {
    id: String(j.$id ?? j.id ?? ''),
    email,
    name: typeof j.name === 'string' && j.name ? j.name : email,
    emailVerified: j.emailVerification === true,
    mfa: j.mfa === true,
  };
}

/** returns the user or throws — callers distinguish "no valid session"
 * (401) from network failures (TypeError etc.) */
export async function getCurrentUserStrict(): Promise<AuthUser> {
  const res = await appwriteRequest('/account', { auth: 'session' });
  if (!res.ok) throw await errorFrom(res);
  const json = (await res.json()) as Record<string, unknown>;
  return userFromJson(json);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await getCurrentUserStrict();
  } catch {
    return null;
  }
}

/** creates a session and persists its secret (survives app restarts);
 * returns the raw response so the caller can detect pending-MFA sessions */
export async function createEmailPasswordSession(
  email: string,
  password: string,
): Promise<void> {
  const res = await appwriteRequest('/account/sessions/email', {
    method: 'POST',
    body: { email, password },
    auth: 'none',
  });
  if (!res.ok) throw await errorFrom(res);
  // the secret travels in the X-Fallback-Cookies response header (JSON map,
  // base64 envelope value) — it authenticates via X-Appwrite-Session
  const fallback = res.headers.get('x-fallback-cookies');
  if (fallback) {
    try {
      const map = JSON.parse(fallback) as Record<string, string>;
      const secret = map[`a_session_${APPWRITE_PROJECT_ID}`];
      if (secret) await persistSessionSecret(secret);
    } catch {
      // header format changed — session stays in-memory only
    }
  }
}

export async function deleteCurrentSession(): Promise<void> {
  try {
    await appwriteRequest('/account/sessions/current', { method: 'DELETE', auth: 'session' });
  } catch {
    // already gone — fine
  }
}

export async function createAccount(name: string, email: string, password: string): Promise<void> {
  const res = await appwriteRequest('/account', {
    method: 'POST',
    body: { userId: 'unique()', email, password, name },
    auth: 'none',
  });
  if (!res.ok) throw await errorFrom(res);
}

export async function sendVerificationEmail(webAppBase: string): Promise<void> {
  const res = await appwriteRequest('/account/verification', {
    method: 'POST',
    body: { url: `${webAppBase}/verify` },
    auth: 'session',
  });
  if (!res.ok) throw await errorFrom(res);
}

export async function requestPasswordRecovery(email: string, webAppBase: string): Promise<void> {
  const res = await appwriteRequest('/account/recovery', {
    method: 'POST',
    body: { email, url: `${webAppBase}/recover` },
    auth: 'none',
  });
  if (!res.ok) throw await errorFrom(res);
}

/* ---------------- email 2FA (MFA) ---------------- */

export async function listMfaFactors(): Promise<{ email: boolean; totp: boolean }> {
  const res = await appwriteRequest('/account/mfa/factors', { auth: 'session' });
  if (!res.ok) return { email: true, totp: false };
  const json = (await res.json()) as Record<string, unknown>;
  return { email: json.email === true, totp: json.totp === true };
}

/** starts a challenge — for the email factor this sends the code */
export async function createMfaChallenge(factor: string): Promise<string> {
  const res = await appwriteRequest('/account/mfa/challenges', {
    method: 'POST',
    body: { factor },
    auth: 'session',
  });
  if (!res.ok) throw await errorFrom(res);
  const json = (await res.json()) as { $id?: string };
  return String(json.$id ?? '');
}

export async function updateMfaChallenge(challengeId: string, otp: string): Promise<void> {
  const res = await appwriteRequest('/account/mfa/challenges', {
    method: 'PUT',
    body: { challengeId, otp },
    auth: 'session',
  });
  if (!res.ok) throw await errorFrom(res);
}

export async function updateMfa(enabled: boolean): Promise<void> {
  // PATCH — a PUT 404s against Cloud 2.2 with an HTML gateway page
  const res = await appwriteRequest('/account/mfa', {
    method: 'PATCH',
    body: { mfa: enabled },
    auth: 'session',
  });
  if (!res.ok) throw await errorFrom(res);
}

export async function getMfaRecoveryCodes(): Promise<string[] | null> {
  const res = await appwriteRequest('/account/mfa/recovery-codes', { auth: 'session' });
  if (!res.ok) return null;
  const json = (await res.json()) as { recoveryCodes?: unknown };
  return Array.isArray(json.recoveryCodes) ? json.recoveryCodes.map(String) : null;
}

export async function createMfaRecoveryCodes(): Promise<string[]> {
  const res = await appwriteRequest('/account/mfa/recovery-codes', { method: 'POST', body: {}, auth: 'session' });
  if (!res.ok) throw await errorFrom(res);
  const json = (await res.json()) as { recoveryCodes?: unknown };
  return Array.isArray(json.recoveryCodes) ? json.recoveryCodes.map(String) : [];
}

/* ---------------- push targets ---------------- */

/** registers (or refreshes) the signed-in user's push target. Best-effort:
 * a failure just means no push, never a broken app. */
export async function createPushTarget(targetId: string, identifier: string): Promise<boolean> {
  try {
    const res = await appwriteRequest('/account/targets', {
      method: 'POST',
      body: { targetId, identifier },
      auth: 'session',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deletePushTarget(targetId: string): Promise<void> {
  try {
    await appwriteRequest(`/account/targets/${targetId}`, { method: 'DELETE', auth: 'session' });
  } catch {
    // no target yet — fine
  }
}

/* ---------------- tables rows (JWT) ---------------- */

export interface RowData {
  [key: string]: unknown;
  $id?: string;
}

/** table ids are a fixed, code-owned set — anything else never reaches fetch */
const KNOWN_TABLES = new Set(Object.values(ROW_TABLES));

/** row ids are UUIDs or hex content-hashes produced by this app; reject
 * anything that could alter the URL structure before the path is built */
function assertSafeRowId(rowId: string): void {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(rowId)) {
    throw new Error(`Refusing unsafe row id: ${rowId.slice(0, 40)}`);
  }
  if (!KNOWN_TABLES.has('subjects')) {
    throw new Error('row tables not initialized');
  }
}

/** row paths must match the tables API shape exactly and only target this
 * project's database — row ids originate from stored data, so the URL is
 * constrained before it can ever reach fetch */
function assertRowPath(path: string): void {
  assertAppwriteEndpoint(path);
  const pattern = new RegExp(
    `^${APPWRITE_ENDPOINT}/tablesdb/${DATABASE_ID}/tables/[a-z_]+/rows(/[a-zA-Z0-9-]+)?(\\?.*)?$`,
  );
  if (!pattern.test(path)) {
    throw new Error(`Refusing row request with unexpected path: ${path.slice(0, 80)}`);
  }
}

async function signedRowRequest(table: string, rowId: string | null, query: string | null, init: { method: string; body?: string }): Promise<Response> {
  assertAppwriteEndpoint(APPWRITE_ENDPOINT);
  if (!KNOWN_TABLES.has(table)) {
    throw new Error(`Refusing row request to unknown table: ${table}`);
  }
  if (rowId != null) assertSafeRowId(rowId);
  const path = `${APPWRITE_ENDPOINT}/tablesdb/${DATABASE_ID}/tables/${table}/rows${rowId ? `/${rowId}` : ''}${query ?? ''}`;
  assertRowPath(path);
  const headers: Record<string, string> = {
    'X-Appwrite-Project': APPWRITE_PROJECT_ID,
    'content-type': 'application/json',
  };
  const doFetch = async (jwt: string | null) => {
    if (!jwt) throw new AppwriteError(401, 'user_unauthorized', 'row call without JWT (signed out?)');
    // both header forms — web parity; never a cookie (credentials below)
    headers['X-Appwrite-JWT'] = jwt;
    headers.authorization = `Bearer ${jwt}`;
    return fetch(path, { method: init.method, headers, body: init.body, credentials: 'omit' });
  };
  let res = await doFetch(await fetchJwt());
  if (res.status === 401) {
    invalidateJwtCache(); // cached token expired — mint a fresh one once
    res = await doFetch(await fetchJwt());
  }
  return res;
}

export async function restListRows(table: string, userId: string): Promise<Array<RowData & { $id: string }>> {
  // one JSON query per `queries[]` param. The JSON goes in RAW — pre-encoding
  // with encodeURIComponent gets DOUBLE-encoded by iOS's URL stack (NSURLSession
  // re-encodes existing % escapes → server sees "%7B…" → "Invalid query:
  // Syntax error"). Raw braces/quotes either pass through or get encoded once
  // by the OS; both parse correctly server-side. The two fixed queries never
  // contain &, # or spaces, so raw is wire-safe.
  const query =
    `queries[]=${JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] })}` +
    `&queries[]=${JSON.stringify({ method: 'limit', values: [100] })}`;
  const res = await signedRowRequest(table, null, query, { method: 'GET' });
  if (!res.ok) {
    // include the body — Appwrite's message/type is the difference
    // between a permissions problem, a scope problem and a param problem
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {}
    throw new Error(`list ${table} → ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  const json = (await res.json()) as { rows?: Array<RowData & { $id: string }> };
  return json.rows ?? [];
}

/** PUT = create-or-update in one request (no 404 probe, no create race) */
export async function restUpsertRow(
  table: string,
  rowId: string,
  data: RowData,
  userId: string,
): Promise<void> {
  const res = await signedRowRequest(table, rowId, null, {
    method: 'PUT',
    body: JSON.stringify({
      data,
      permissions: [`read("user:${userId}")`, `write("user:${userId}")`],
    }),
  });
  if (!res.ok) {
    throw new Error(`upsert ${table}/${rowId} → ${res.status}: ${(await res.text()).slice(0, 120)}`);
  }
}

export async function restSoftDeleteRow(table: string, rowId: string, userId: string): Promise<void> {
  const res = await signedRowRequest(table, rowId, null, {
    method: 'PATCH',
    body: JSON.stringify({ data: { deleted: true, userId } }),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete ${table}/${rowId} → ${res.status}`);
  }
}

/* ---------------- storage (study-doc raw files, best effort) ---------------- */

export async function storageUploadFile(
  filePath: string,
  fileName: string,
  ownerId: string | null,
): Promise<string | null> {
  const jwt = await fetchJwt();
  if (!jwt) throw new Error('no JWT for storage upload');
  const form = new FormData();
  form.append('fileId', 'unique()');
  if (ownerId) {
    // per-file permissions — the bucket has file security on
    form.append('permissions[]', `read("user:${ownerId}")`);
    form.append('permissions[]', `write("user:${ownerId}")`);
  }
  // React Native's FormData takes a file descriptor, not a Blob
  form.append('file', { uri: filePath, name: fileName, type: 'application/octet-stream' } as unknown as Blob);
  assertAppwriteEndpoint(`${APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files`);
  const res = await fetch(`${APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files`, {
    method: 'POST',
    headers: {
      'X-Appwrite-Project': APPWRITE_PROJECT_ID,
      'X-Appwrite-JWT': jwt,
      authorization: `Bearer ${jwt}`,
    },
    body: form,
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(`storage upload → ${res.status}`);
  const json = (await res.json()) as { $id?: string };
  return json.$id ?? null;
}

/* ---------------- realtime (cross-device pulls) ---------------- */

let realtimeWs: WebSocket | null = null;

export function connectRealtime(
  channels: string[],
  onEvent: (payload: Record<string, unknown>, events: string[]) => void,
): void {
  disconnectRealtime();
  if (!sessionSecret) return;
  const qs = [
    `project=${encodeURIComponent(APPWRITE_PROJECT_ID)}`,
    ...channels.map((c) => `channels[]=${encodeURIComponent(c)}`),
  ].join('&');
  const url = `${APPWRITE_ENDPOINT.replace(/^http/, 'ws')}/realtime?${qs}`;
  try {
    // React Native's WebSocket accepts handshake headers (not a web API) —
    // this is how the session reaches the realtime server
    const RNWebSocket = WebSocket as unknown as {
      new (
        url: string,
        protocols?: string | null,
        options?: { headers?: Record<string, string> },
      ): WebSocket;
    };
    const ws = new RNWebSocket(url, undefined, {
      headers: { 'X-Appwrite-Session': sessionSecret },
    });
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string;
          events?: string[];
          payload?: Record<string, unknown>;
        };
        if (msg.type === 'event' && msg.payload && msg.events) {
          onEvent(msg.payload, msg.events);
        }
      } catch {
        // a malformed event must never crash the app
      }
    };
    ws.onerror = () => {};
    realtimeWs = ws;
  } catch {
    // realtime is an optimization — foreground resync covers correctness
  }
}

export function disconnectRealtime(): void {
  if (realtimeWs) {
    try {
      realtimeWs.close();
    } catch {}
    realtimeWs = null;
  }
}
