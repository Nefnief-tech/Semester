/**
 * Client-side encryption for synced data.
 *
 * Appwrite never receives a readable value: text fields are sealed here with
 * AES-256-GCM under a per-user data key. The data key is wrapped twice —
 * once by a password-derived key (PBKDF2-SHA256) and once by a random
 * recovery key — and the wrapped copies live in the user's Appwrite prefs,
 * so a new device can recover the key from either the password or the
 * recovery code, while the server only ever sees ciphertext.
 *
 * Wire format: "enc:v1:" + base64(iv[12] || ciphertext+tag).
 */

export type Bytes = Uint8Array<ArrayBuffer>;

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
export const PBKDF2_ITERATIONS = 600_000;

/** Appwrite prefs entry holding the wrapped data key. */
export interface E2eePrefs {
  v: 1;
  salt: string;
  iter: number;
  wrapped: string;
  recovery: string;
}

export const isSealed = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith(PREFIX);

export function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Bytes {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** PBKDF2(password) → non-extractable AES-GCM key */
export async function derivePasswordKey(
  password: string,
  salt: Bytes,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"],
  );
}

export async function importDataKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
    "wrapKey",
    "unwrapKey",
  ]);
}

export async function generateDataKey(): Promise<{ raw: Bytes; key: CryptoKey }> {
  const raw = randomBytes(KEY_BYTES);
  return { raw, key: await importDataKey(raw) };
}

/** seal a UTF-8 string; already-sealed input passes through untouched */
export async function seal(key: CryptoKey, plaintext: string): Promise<string> {
  if (isSealed(plaintext)) return plaintext;
  const iv = randomBytes(IV_BYTES);
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const out = new Uint8Array(IV_BYTES + sealed.byteLength);
  out.set(iv);
  out.set(new Uint8Array(sealed), IV_BYTES);
  return PREFIX + toBase64(out);
}

/** open a sealed string; plaintext (pre-encryption rows) passes through */
export async function open(key: CryptoKey, value: string): Promise<string> {
  if (!isSealed(value)) return value;
  const bytes = fromBase64(value.slice(PREFIX.length));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, IV_BYTES) },
    key,
    bytes.slice(IV_BYTES),
  );
  return new TextDecoder().decode(plain);
}

/** wrap raw key bytes under another key */
export async function wrapBytes(key: CryptoKey, raw: Bytes): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, raw);
  const out = new Uint8Array(IV_BYTES + sealed.byteLength);
  out.set(iv);
  out.set(new Uint8Array(sealed), IV_BYTES);
  return PREFIX + toBase64(out);
}

export async function unwrapBytes(key: CryptoKey, value: string): Promise<Bytes> {
  if (!isSealed(value)) throw new Error("not a wrapped key");
  const bytes = fromBase64(value.slice(PREFIX.length));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, IV_BYTES) },
    key,
    bytes.slice(IV_BYTES),
  );
  return new Uint8Array(plain);
}

/* ---------------- recovery key ----------------
 * Crockford base32: no I, L, O, U, so the code survives handwriting and the
 * usual 0/O, 1/I/L mixups. 32 random bytes → 52 characters, shown grouped. */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RECOVERY_BYTES = 32;

export function encodeRecoveryKey(raw: Bytes): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

export function decodeRecoveryKey(code: string): Bytes {
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = CROCKFORD.indexOf(char);
    if (index < 0) throw new Error("invalid recovery key");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  if (out.length !== RECOVERY_BYTES) throw new Error("invalid recovery key");
  return new Uint8Array(out);
}

export function generateRecoveryKey(): { code: string; raw: Bytes } {
  const raw = randomBytes(RECOVERY_BYTES);
  return {
    code: encodeRecoveryKey(raw).replace(/(.{5})/g, "$1 ").trim(),
    raw,
  };
}

export async function recoveryKeyToCryptoKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export function newSalt(): Bytes {
  return randomBytes(SALT_BYTES);
}

export { toBase64, fromBase64, SALT_BYTES, KEY_BYTES };
