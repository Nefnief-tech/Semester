"use client";

/**
 * Data-key lifecycle for encrypted sync.
 *
 * A random per-user data key encrypts every synced text field. Two wrapped
 * copies are kept in the account prefs (server sees ciphertext only):
 *   wrapped  — the data key under PBKDF2(password)
 *   recovery — the data key under a one-time recovery key
 * The unwrapped key is cached per device so reloads and background sync keep
 * working without a password prompt.
 *
 * Web caveat: that cache is browser storage, so this protects the cloud copy,
 * not a device that is already compromised (script/XSS can read the key).
 */
import { create } from "zustand";
import { account } from "@/lib/auth/appwrite";
import { updatePrefsMerged } from "@/lib/auth/prefs";
import { useAuthStore, useSyncMetaStore } from "@/lib/store/auth";
import {
  PBKDF2_ITERATIONS,
  decodeRecoveryKey,
  derivePasswordKey,
  fromBase64,
  generateDataKey,
  generateRecoveryKey,
  importDataKey,
  newSalt,
  recoveryKeyToCryptoKey,
  toBase64,
  unwrapBytes,
  wrapBytes,
  type Bytes,
  type E2eePrefs,
} from "./e2ee";

type KeyringStatus = "idle" | "locked" | "unlocked";

interface KeyringState {
  status: KeyringStatus;
  key: CryptoKey | null;
  /** freshly generated recovery code — shown once, then cleared */
  recoveryKey: string | null;
  error: string | null;
  setState: (patch: Partial<Omit<KeyringState, "setState">>) => void;
}

export const useKeyringStore = create<KeyringState>()((set) => ({
  status: "idle",
  key: null,
  recoveryKey: null,
  error: null,
  setState: (patch) => set(patch),
}));

const cacheKey = (userId: string) => `semester.e2ee.${userId}`;

function readCachedKey(userId: string): Bytes | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? fromBase64(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedKey(userId: string, raw: Bytes) {
  try {
    localStorage.setItem(cacheKey(userId), toBase64(raw));
  } catch {
    // storage can be full/blocked — the next unlock just asks for the password
  }
}

function clearCachedKeys() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("semester.e2ee.")) localStorage.removeItem(key);
    }
  } catch {}
}

async function finishUnlock(userId: string, raw: Bytes, recoveryKey: string | null) {
  const key = await importDataKey(raw);
  writeCachedKey(userId, raw);
  useKeyringStore.getState().setState({ status: "unlocked", key, recoveryKey, error: null });
  return key;
}

/**
 * The account prefs. A failed read must throw: treating it as "no key yet"
 * would create a second key on top of data sealed with the first one, which
 * nothing could ever open again.
 */
async function readPrefs(): Promise<Record<string, unknown>> {
  if (!account) throw new Error("Auth is not configured");
  return (await account.getPrefs()) as Record<string, unknown>;
}

/**
 * Called after a successful sign-in. Creates the key on the first device that
 * signs in with a password, otherwise unlocks with the cached or password key.
 */
export async function bootstrapEncryption(userId: string, password?: string): Promise<void> {
  const state = useKeyringStore.getState();
  if (state.status === "unlocked" && state.key) return;

  const cached = readCachedKey(userId);
  if (cached) {
    await finishUnlock(userId, cached, null);
    return;
  }

  const prefs = await readPrefs();
  const existing = prefs.e2ee as E2eePrefs | undefined;

  if (existing) {
    if (!password) {
      state.setState({ status: "locked", key: null, error: null });
      return;
    }
    try {
      const kek = await derivePasswordKey(password, fromBase64(existing.salt), existing.iter);
      await finishUnlock(userId, await unwrapBytes(kek, existing.wrapped), null);
    } catch {
      state.setState({ status: "locked", key: null, error: "Could not unlock your data key." });
    }
    return;
  }

  if (!password) {
    // no key yet and no password in hand (MFA/recovery session) — the gate
    // sets it up once the user provides one
    state.setState({ status: "locked", key: null, error: null });
    return;
  }

  const { raw, key } = await generateDataKey();
  const salt = newSalt();
  const kek = await derivePasswordKey(password, salt);
  const recovery = generateRecoveryKey();
  const recoveryWrapped = await wrapBytes(await recoveryKeyToCryptoKey(recovery.raw), raw);

  await updatePrefsMerged({
    e2ee: {
      v: 1,
      salt: toBase64(salt),
      iter: PBKDF2_ITERATIONS,
      wrapped: await wrapBytes(kek, raw),
      recovery: recoveryWrapped,
    } satisfies E2eePrefs,
  });

  writeCachedKey(userId, raw);
  // every row this device already synced is plaintext in the cloud — drop the
  // digests so the next sync pushes all of them back sealed
  useSyncMetaStore.getState().clearRowDigests();
  useKeyringStore.getState().setState({
    status: "unlocked",
    key,
    recoveryKey: recovery.code,
    error: null,
  });
}

export async function unlockWithPassword(password: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error("Not signed in");
  const prefs = await readPrefs();
  const existing = prefs.e2ee as E2eePrefs | undefined;
  if (!existing) return bootstrapEncryption(userId, password);
  try {
    const kek = await derivePasswordKey(password, fromBase64(existing.salt), existing.iter);
    await finishUnlock(userId, await unwrapBytes(kek, existing.wrapped), null);
  } catch {
    useKeyringStore.getState().setState({ status: "locked", error: "That password does not open the data key." });
    throw new Error("That password does not open the data key.");
  }
}

export async function unlockWithRecoveryKey(code: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error("Not signed in");
  const prefs = await readPrefs();
  const existing = prefs.e2ee as E2eePrefs | undefined;
  if (!existing) throw new Error("This account has no encrypted data yet.");
  try {
    const key = await recoveryKeyToCryptoKey(decodeRecoveryKey(code));
    await finishUnlock(userId, await unwrapBytes(key, existing.recovery), null);
  } catch {
    useKeyringStore.getState().setState({ status: "locked", error: "That recovery key is not valid." });
    throw new Error("That recovery key is not valid.");
  }
}

/** drop the in-memory + device copy (sign-out, account switch) */
export function lockEncryption() {
  clearCachedKeys();
  useKeyringStore.getState().setState({ status: "idle", key: null, recoveryKey: null, error: null });
}

export const dataKey = (): CryptoKey | null => useKeyringStore.getState().key;
