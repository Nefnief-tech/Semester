/* Startup hydration gate: zustand's persist middleware rehydrates from
 * AsyncStorage asynchronously — the sync engine must not run before every
 * store has read its slice. Implemented as a deadline poll (NOT
 * onFinishHydration listeners — that promise was observed to never settle,
 * wedging the app on a black screen). Never throws, never hangs: after the
 * deadline it reports the stragglers and continues. */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useHomeworkStore } from './homework_store';
import { useEventsStore } from './events_store';
import { useGradesStore } from './grades_store';
import { usePortalStore } from './portal_store';
import { useSettingsStore } from './settings_store';
import { useStudyroomStore } from './studyroom_store';
import { useSubjectsStore } from './subjects_store';
import { useSyncMetaStore } from './auth_store';
import { useTimetableStore } from './timetable_store';
import { useTodosStore } from './todos_store';

const PERSISTED = [
  useSubjectsStore,
  useTodosStore,
  useHomeworkStore,
  useGradesStore,
  useEventsStore,
  useTimetableStore,
  useStudyroomStore,
  usePortalStore,
  useSyncMetaStore,
  useSettingsStore,
] as const;

function hydratedCount(): { done: number; total: number; stuck: string[] } {
  const stuck: string[] = [];
  let done = 0;
  for (const store of PERSISTED) {
    if (store.persist?.hasHydrated?.()) done++;
    else stuck.push(String(store.persist?.getOptions?.().name ?? '<unnamed>'));
  }
  return { done, total: PERSISTED.length, stuck };
}

/** resolves once every persisted store has rehydrated — or after the
 * deadline, whichever comes first (the log says which stores lagged) */
export async function whenHydrated(timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let status = hydratedCount();
  while (status.done < status.total && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    status = hydratedCount();
  }
  if (status.done < status.total) {
    console.warn(
      `[boot] store hydration incomplete after ${timeoutMs}ms (${status.done}/${status.total}); continuing without: ${status.stuck.join(', ')}`,
    );
  } else {
    console.log(`[boot] ${status.done}/${status.total} stores hydrated`);
  }
}

/** debugging helper — dumps raw AsyncStorage keys that look like ours */
export async function debugDumpStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    console.log('[boot] storage keys:', keys.filter((k) => k.startsWith('semester.')).join(', '));
  } catch {
    // diagnostics only
  }
}
