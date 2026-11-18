/* Data-key lifecycle for encrypted sync — mirror of the web keyring
 * (`src/lib/crypto/keyring.ts`).
 *
 * A random per-user data key encrypts every synced text field. Two wrapped
 * copies live in the account prefs (server sees ciphertext only):
 *   wrapped  — the data key under PBKDF2(password)
 *   recovery — the data key under a one-time recovery key
 * The unwrapped key is cached per device so restarts and background sync keep
 * working without a password prompt.
 *
 * Caveat: that cache is AsyncStorage, so this protects the cloud copy, not a
 * device that is already unlocked and compromised. */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getPrefs, updatePrefs } from '../appwrite';
import { useAuthStore, useSyncMetaStore } from '../../stores/auth_store';
import {
  E2eePrefs,
  PBKDF2_ITERATIONS,
  decodeRecoveryKey,
  derivePasswordKey,
  fromBase64,
  generateDataKey,
  generateRecoveryKey,
  newSalt,
  toBase64,
  unwrapBytes,
  wrapBytes,
} from './e2ee';

export type KeyringStatus = 'idle' | 'locked' | 'unlocked';

interface KeyringState {
  status: KeyringStatus;
  key: Uint8Array | null;
  /** freshly created recovery code — shown once, then cleared */
  recoveryKey: string | null;
  error: string | null;
  setState: (patch: Partial<Omit<KeyringState, 'setState'>>) => void;
}

export const useKeyringStore = create<KeyringState>()((set) => ({
  status: 'idle',
  key: null,
  recoveryKey: null,
  error: null,
  setState: (patch) => set(patch),
}));

const cacheKey = (userId: string) => `semester.e2ee.${userId}`;

async function readCachedKey(userId: string): Promise<Uint8Array | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? fromBase64(raw) : null;
  } catch {
    return null;
  }
}

async function writeCachedKey(userId: string, raw: Uint8Array): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(userId), toBase64(raw));
  } catch {
    // storage blocked — the next unlock just asks for the password
  }
}

async function clearCachedKeys(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith('semester.e2ee.'));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {}
}

async function finishUnlock(userId: string, raw: Uint8Array, recoveryKey: string | null) {
  await writeCachedKey(userId, raw);
  useKeyringStore.getState().setState({ status: 'unlocked', key: raw, recoveryKey, error: null });
  return raw;
}

/**
 * Called after a successful sign-in. Creates the key on the first device that
 * signs in with a password, otherwise unlocks with the cached or password key.
 */
export async function bootstrapEncryption(userId: string, password?: string): Promise<void> {
  const state = useKeyringStore.getState();
  if (state.status === 'unlocked' && state.key) return;

  const cached = await readCachedKey(userId);
  if (cached) {
    await finishUnlock(userId, cached, null);
    return;
  }

  const prefs = await getPrefs();
  const existing = prefs.e2ee as E2eePrefs | undefined;

  if (existing) {
    if (!password) {
      state.setState({ status: 'locked', key: null, error: null });
      return;
    }
    try {
      const kek = await derivePasswordKey(password, fromBase64(existing.salt), existing.iter);
      await finishUnlock(userId, await unwrapBytes(kek, existing.wrapped), null);
    } catch {
      state.setState({ status: 'locked', key: null, error: 'Could not unlock your data key.' });
    }
    return;
  }

  if (!password) {
    // no key yet and no password in hand (MFA / restored session) — the gate
    // sets it up once the user provides one
    state.setState({ status: 'locked', key: null, error: null });
    return;
  }

  const raw = generateDataKey();
  const salt = newSalt();
  const kek = await derivePasswordKey(password, salt);
  const recovery = generateRecoveryKey();

  await updatePrefs({
    ...prefs,
    e2ee: {
      v: 1,
      salt: toBase64(salt),
      iter: PBKDF2_ITERATIONS,
      wrapped: await wrapBytes(kek, raw),
      recovery: await wrapBytes(recovery.raw, raw),
    } satisfies E2eePrefs,
  });

  await finishUnlock(userId, raw, recovery.code);
  // every row this device already synced is plaintext in the cloud — drop the
  // digests so the next sync pushes all of them back sealed
  useSyncMetaStore.getState().clearRowDigests();
}

export async function unlockWithPassword(password: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('Not signed in');
  const prefs = await getPrefs();
  const existing = prefs.e2ee as E2eePrefs | undefined;
  if (!existing) return bootstrapEncryption(userId, password);
  try {
    const kek = await derivePasswordKey(password, fromBase64(existing.salt), existing.iter);
    await finishUnlock(userId, await unwrapBytes(kek, existing.wrapped), null);
  } catch {
    useKeyringStore
      .getState()
      .setState({ status: 'locked', error: 'That password does not open the data key.' });
    throw new Error('That password does not open the data key.');
  }
}

export async function unlockWithRecoveryKey(code: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('Not signed in');
  const prefs = await getPrefs();
  const existing = prefs.e2ee as E2eePrefs | undefined;
  if (!existing) throw new Error('This account has no encrypted data yet.');
  try {
    const raw = await unwrapBytes(decodeRecoveryKey(code), existing.recovery);
    await finishUnlock(userId, raw, null);
  } catch {
    useKeyringStore.getState().setState({ status: 'locked', error: 'That recovery key is not valid.' });
    throw new Error('That recovery key is not valid.');
  }
}

/** drop the in-memory + device copy (sign-out, account switch) */
export async function lockEncryption(): Promise<void> {
  await clearCachedKeys();
  useKeyringStore
    .getState()
    .setState({ status: 'idle', key: null, recoveryKey: null, error: null });
}

export const dataKey = (): Uint8Array | null => useKeyringStore.getState().key;
