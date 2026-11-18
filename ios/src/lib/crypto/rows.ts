/* Which row columns are sealed before they leave the device — mirror of
 * `src/lib/crypto/rows.ts` (web) and `lib/crypto/rows.dart` (Android).
 *
 * Rule of thumb: every string a person typed or that names their school life
 * is sealed, as are grade numbers (points, weight). Other structural values —
 * ids, dates, flags, the subject link — stay readable so syncing works. */
import { isSealed, open, seal } from './e2ee';

const SEALED_FIELDS: Record<string, string[]> = {
  subjects: ['name'],
  todos: ['title', 'notes'],
  homeworks: ['title', 'notes'],
  grades: ['title'],
  events: ['title', 'notes'],
  timetable_entries: ['subject', 'teacher', 'room', 'time'],
  chat_messages: ['content', 'sources'],
  decks: ['title'],
  flashcards: ['front', 'back'],
  portal_entries: ['course', 'courseOld', 'substitute', 'room', 'info'],
  portal_courses: ['course'],
};

/** numeric columns stored as sealed strings (their cloud attribute is a string) */
const SEALED_NUMBERS: Record<string, string[]> = {
  grades: ['points', 'weight'],
};

export const sealedFields = (table: string): readonly string[] => SEALED_FIELDS[table] ?? [];
export const sealedNumbers = (table: string): readonly string[] => SEALED_NUMBERS[table] ?? [];

/** seal the text/number fields of a row (copy; already-sealed values pass through) */
export async function encryptRow(
  key: Uint8Array,
  table: string,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const fields = sealedFields(table);
  const numbers = sealedNumbers(table);
  if (fields.length === 0 && numbers.length === 0) return row;
  const out = { ...row };
  for (const field of fields) {
    const value = out[field];
    if (typeof value !== 'string' || value === '') continue;
    out[field] = await seal(key, value);
  }
  for (const field of numbers) {
    const value = out[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[field] = await seal(key, String(value));
  }
  return out;
}

/** open the text fields of a row; plaintext rows (pre-encryption) pass through */
export async function decryptRow(
  key: Uint8Array | null,
  table: string,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const fields = sealedFields(table);
  const numbers = sealedNumbers(table);
  if (fields.length === 0 && numbers.length === 0) return row;
  const out = { ...row };
  for (const field of fields) {
    const value = out[field];
    if (!isSealed(value)) continue;
    if (!key) throw new Error('locked');
    out[field] = await open(key, value);
  }
  for (const field of numbers) {
    const value = out[field];
    if (!isSealed(value)) continue;
    if (!key) throw new Error('locked');
    const plain = Number(await open(key, value));
    if (!Number.isFinite(plain)) throw new Error(`invalid sealed number in ${table}.${field}`);
    out[field] = plain;
  }
  return out;
}

/** True when a row still carries plaintext in a sealed column — a row written
 *  before encryption was switched on. The pull re-pushes those sealed. */
export function needsSealing(table: string, row: Record<string, unknown>): boolean {
  return (
    sealedFields(table).some((field) => {
      const value = row[field];
      return typeof value === 'string' && value !== '' && !isSealed(value);
    }) ||
    sealedNumbers(table).some((field) => {
      const value = row[field];
      return typeof value === 'number' && Number.isFinite(value);
    })
  );
}
