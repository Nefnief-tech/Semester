/* Port of `lib/stores/timetable_store.dart`. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import { TimetableEntry, timetableEntryFromJson, timetableEntryToJson } from '../models/types';
import { hashId } from '../utils/utils';
import { appStorage, persist, safeMerge } from './base';

/** stable cloud row id for an entry — derived from its content, so all
 * clients derive the same id without coordinating (entries have no id) */
export function timetableRowId(e: TimetableEntry): string {
  return hashId([e.day, e.period, e.time ?? '', e.subject, e.teacher ?? '', e.room ?? ''].join('|'));
}

interface TimetableState {
  entries: TimetableEntry[];
  updatedAt: number;
  setTimetable: (entries: TimetableEntry[]) => void;
  clear: () => void;
  /** row-level sync: insert or replace an entry (content-hash identity) */
  upsertEntry: (entry: TimetableEntry) => void;
  /** row-level sync: drop the entry with this cloud row id */
  removeEntry: (rowId: string) => void;
}

export const useTimetableStore = create<TimetableState>()(
  persist<TimetableState, [], [], Pick<TimetableState, 'entries' | 'updatedAt'>>(
    (set, get) => ({
      entries: [],
      updatedAt: 0,
      setTimetable: (entries) => set({ entries, updatedAt: Date.now() }),
      clear: () => set({ entries: [], updatedAt: Date.now() }),
      upsertEntry: (entry) => {
        const rowId = timetableRowId(entry);
        set((s) => ({
          entries: [...s.entries.filter((e) => timetableRowId(e) !== rowId), entry],
        }));
      },
      removeEntry: (rowId) =>
        set((s) => ({ entries: s.entries.filter((e) => timetableRowId(e) !== rowId) })),
    }),
    {
      name: 'semester.timetable',
      version: 1,
      storage: appStorage,
      partialize: (s: TimetableState) => ({
        entries: s.entries.map(timetableEntryToJson),
        updatedAt: s.updatedAt,
      }),
      merge: safeMerge((persisted: any, current: TimetableState) => {
        const p = persisted as { entries?: unknown[]; updatedAt?: number };
        return {
          ...current,
          entries: (p.entries ?? [])
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map(timetableEntryFromJson),
          updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : 0,
        };
      }),
    } as unknown as PersistOptions<TimetableState, Pick<TimetableState, 'entries' | 'updatedAt'>>,
  ),
);
