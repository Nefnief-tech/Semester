/* Port of `lib/stores/auth_store.dart` — auth + sync status (not persisted;
 * restored from the Appwrite session on startup) plus the sync-meta store
 * (persisted) that tracks last-synced row digests. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import { appStorage, persist } from './base';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  mfa: boolean;
}

export type SyncStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in';

interface AuthState {
  user: AuthUser | null;
  status: SyncStatus;
  syncing: boolean;
  online: boolean;
  lastSyncedAt: number | null;
  syncError: string | null;
  setAuth: (user: AuthUser | null, status: SyncStatus) => void;
  setSyncing: (v: boolean) => void;
  setSynced: (at: number) => void;
  setSyncError: (message: string) => void;
  setOnline: (online: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'unconfigured',
  syncing: false,
  online: true,
  lastSyncedAt: null,
  syncError: null,
  setAuth: (user, status) => set({ user, status, syncError: null }),
  setSyncing: (v) => set({ syncing: v }),
  setSynced: (at) => set({ lastSyncedAt: at, syncing: false, syncError: null }),
  setSyncError: (message) => set({ syncError: message, syncing: false }),
  setOnline: (online) => set({ online }),
}));

/* ---------------- sync meta ---------------- */

export interface SyncMetaState {
  dirtyAt: Record<string, number>;
  /** keys whose cloud state this device has successfully observed */
  loaded: string[];
  /** last-synced content digests for row collections: {table: {rowId: hash}} */
  rowDigests: Record<string, Record<string, string>>;
  setRowDigests: (table: string, digests: Record<string, string>) => void;
  markLoaded: (key: string) => void;
  markDirty: (key: string, at: number) => void;
  clearDirty: (key: string) => void;
}

export const useSyncMetaStore = create<SyncMetaState>()(
  persist<SyncMetaState, [], [], Pick<SyncMetaState, 'dirtyAt' | 'loaded' | 'rowDigests'>>(
    (set, get) => ({
      dirtyAt: {},
      loaded: [],
      rowDigests: {},
      setRowDigests: (table, digests) =>
        set((s) => ({ rowDigests: { ...s.rowDigests, [table]: digests } })),
      markLoaded: (key) => {
        if (get().loaded.includes(key)) return;
        set((s) => ({ loaded: [...s.loaded, key] }));
      },
      markDirty: (key, at) => set((s) => ({ dirtyAt: { ...s.dirtyAt, [key]: at } })),
      clearDirty: (key) =>
        set((s) => {
          if (!(key in s.dirtyAt)) return s;
          const dirtyAt = { ...s.dirtyAt };
          delete dirtyAt[key];
          return { dirtyAt };
        }),
    }),
    {
      name: 'semester.syncmeta',
      version: 4,
      storage: appStorage,
      partialize: (s: SyncMetaState) => ({
        dirtyAt: s.dirtyAt,
        loaded: s.loaded,
        rowDigests: s.rowDigests,
      }),
    } as unknown as PersistOptions<SyncMetaState, Pick<SyncMetaState, 'dirtyAt' | 'loaded' | 'rowDigests'>>,
  ),
);
