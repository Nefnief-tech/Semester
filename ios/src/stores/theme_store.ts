/* Port of `lib/stores/auth_store.dart` ThemeStore — light / dark / system.
 * The web ThemeToggle stores a bare "dark"/"light" string under this key, so
 * the mobile port reads and writes the same shape (zustand's envelope would
 * break interchangeability, hence the hand-rolled persistence). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'semester.theme';

interface ThemeState {
  /** null = follow system */
  dark: boolean | null;
  setDark: (value: boolean | null) => void;
  /** reads the persisted value once at startup — called before the UI mounts */
  init: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  dark: null,
  setDark: (value) => {
    set({ dark: value });
    if (value == null) {
      AsyncStorage.removeItem(KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(KEY, value ? 'dark' : 'light').catch(() => {});
    }
  },
  init: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw === null) return;
      const v = raw.replace(/^"|"$/g, '');
      if (v === 'dark') set({ dark: true });
      else if (v === 'light') set({ dark: false });
    } catch {
      // corrupted entry — follow system
    }
  },
}));
