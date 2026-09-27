/* Persistence plumbing shared by the store ports. Each store persists the
 * same JSON shape (zustand `persist` envelope: {"state": {…}, "version": n})
 * under the same AsyncStorage/localStorage key as the web app, so a backup
 * of one reads as the other. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

export const appStorage = createJSONStorage(() => AsyncStorage);

export { persist };

/* NOTE: no re-export of ./hydration here — whenHydrated imports every store,
 * and the stores import this module; a re-export would create a require
 * cycle that evaluates hydration before the stores finish initializing
 * (`store.persist` came up undefined that way). App.tsx imports
 * ./stores/hydration directly. */

/** wraps a persist `merge` so it can never wedge rehydration. zustand calls
 * merge(undefined, current) when a store has nothing persisted yet, and a
 * throw in merge leaves the store stuck at hasHydrated=false forever. */
export function safeMerge<S, P>(
  merge: (persisted: P, current: S) => S,
): (persisted: unknown, current: S) => S {
  return (persisted, current) => {
    if (persisted == null) return current;
    try {
      return merge(persisted as P, current);
    } catch (e) {
      console.warn('[persist] merge failed, keeping current state:', String(e));
      return current;
    }
  };
}
