/* Client-side encryption for synced data — mirror of the web client
 * (`src/lib/crypto/e2ee.ts`): same wire format, so a row sealed on the web or
 * on Android opens here and vice versa.
 *
 * Appwrite never receives a readable value: text fields are sealed with
 * AES-256-GCM under a per-user data key. That key is wrapped twice — under a
 * password-derived key (PBKDF2-HMAC-SHA256) and under a random recovery key —
 * and the wrapped copies live in the account prefs, so a new device can
 * recover the key while the server only ever sees ciphertext.
 *
 * Wire format: "enc:v1:" + base64(nonce[12] || ciphertext || tag[16]).
 *
 * Pure JS on purpose (`@noble/*`): no native module means no rebuild and it
 * runs in Expo Go. The price is PBKDF2 speed — ~5 s for a new device's first
 * unlock, after which the key is cached and unlock is instant. */

import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';

const PREFIX = 'enc:v1:';
const NONCE_BYTES = 12;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const RECOVERY_BYTES = 32;

/** OWASP-recommended work factor; must match web + Android. */
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
  typeof value === 'string' && value.startsWith(PREFIX);

export const randomBytes = (length: number): Uint8Array =>
  Crypto.getRandomBytes(length);

/* React Native has no btoa/atob — 12 lines beat a dependency. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

export function fromBase64(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array((clean.length * 3) >> 2);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | B64.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      out[index++] = (buffer >> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return out.subarray(0, index);
}

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value);
const fromUtf8 = (value: Uint8Array): string => new TextDecoder().decode(value);

/** PBKDF2(password) → 32-byte AES-GCM key */
export async function derivePasswordKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<Uint8Array> {
  return pbkdf2(sha256, utf8(password), salt, { c: iterations, dkLen: KEY_BYTES });
}

/** nonce || ciphertext || tag, base64, prefixed */
function pack(nonce: Uint8Array, sealed: Uint8Array): string {
  const out = new Uint8Array(NONCE_BYTES + sealed.length);
  out.set(nonce);
  out.set(sealed, NONCE_BYTES);
  return PREFIX + toBase64(out);
}

function unpack(value: string): { nonce: Uint8Array; sealed: Uint8Array } {
  const bytes = fromBase64(value.slice(PREFIX.length));
  return { nonce: bytes.subarray(0, NONCE_BYTES), sealed: bytes.subarray(NONCE_BYTES) };
}

/** seal a UTF-8 string; already-sealed input passes through untouched */
export async function seal(key: Uint8Array, plaintext: string): Promise<string> {
  if (isSealed(plaintext)) return plaintext;
  const nonce = randomBytes(NONCE_BYTES);
  return pack(nonce, gcm(key, nonce).encrypt(utf8(plaintext)));
}

/** open a sealed string; plaintext (pre-encryption rows) passes through */
export async function open(key: Uint8Array, value: string): Promise<string> {
  if (!isSealed(value)) return value;
  const { nonce, sealed } = unpack(value);
  return fromUtf8(gcm(key, nonce).decrypt(sealed));
}

export async function wrapBytes(key: Uint8Array, raw: Uint8Array): Promise<string> {
  const nonce = randomBytes(NONCE_BYTES);
  return pack(nonce, gcm(key, nonce).encrypt(raw));
}

export async function unwrapBytes(key: Uint8Array, value: string): Promise<Uint8Array> {
  if (!isSealed(value)) throw new Error('not a wrapped key');
  const { nonce, sealed } = unpack(value);
  return gcm(key, nonce).decrypt(sealed);
}

export const newSalt = (): Uint8Array => randomBytes(SALT_BYTES);

export const generateDataKey = (): Uint8Array => randomBytes(KEY_BYTES);

/* ---------------- recovery key ----------------
 * Crockford base32: no I, L, O, U, so the code survives handwriting and the
 * usual 0/O, 1/I/L mixups. 32 random bytes → 52 characters, shown grouped. */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function encodeRecoveryKey(raw: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
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

export function decodeRecoveryKey(code: string): Uint8Array {
  const clean = code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = CROCKFORD.indexOf(char);
    if (index < 0) throw new Error('invalid recovery key');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  if (out.length !== RECOVERY_BYTES) throw new Error('invalid recovery key');
  return new Uint8Array(out);
}

/** the recovery key is 256 bits of entropy already — no KDF, it *is* the key */
export function generateRecoveryKey(): { code: string; raw: Uint8Array } {
  const raw = randomBytes(RECOVERY_BYTES);
  return {
    code: encodeRecoveryKey(raw).replace(/(.{5})/g, '$1 ').trim(),
    raw,
  };
}
