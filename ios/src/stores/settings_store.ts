/* Port of `lib/stores/settings_store.dart` — the Semester web server the app
 * talks to for AI study-room features and the school-portal fetch (the AI key
 * and portal scraper live server-side). Device-local, never synced.
 * On iOS the simulator reaches the host via plain localhost. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import { appStorage, persist, safeMerge } from './base';

export const DEFAULT_SERVER_URL = 'http://localhost:8899';

interface SettingsState {
  serverUrl: string;
  setServerUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist<SettingsState, [], [], Pick<SettingsState, 'serverUrl'>>(
    (set, get) => ({
      serverUrl: DEFAULT_SERVER_URL,
      setServerUrl: (url) => {
        const trimmed = url.trim();
        if (trimmed) set({ serverUrl: trimmed });
      },
    }),
    {
      name: 'semester.server',
      version: 1,
      storage: appStorage,
      partialize: (s: SettingsState) => ({ serverUrl: s.serverUrl }),
      // rehydration errors surface here (persist's catch calls this with the
      // thrown error) — otherwise a failing store silently never hydrates
      onRehydrateStorage: () => (_state: unknown, error: unknown) => {
        if (error) console.warn('[persist] semester.server rehydrate failed:', String(error));
      },
      merge: safeMerge((persisted: any, current: SettingsState) => {
        const v = (persisted as { serverUrl?: unknown }).serverUrl;
        return { ...current, serverUrl: typeof v === 'string' && v ? v : current.serverUrl };
      }),
    } as unknown as PersistOptions<SettingsState, Pick<SettingsState, 'serverUrl'>>,
  ),
);
