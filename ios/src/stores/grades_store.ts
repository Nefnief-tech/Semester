/* Port of `lib/stores/grades_store.dart`. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import { GradeEntry, gradeEntryFromJson, gradeEntryToJson } from '../models/types';
import { percentToPoints, uid } from '../utils/utils';
import { appStorage, persist, safeMerge } from './base';

/** converts pre-Punkte entries (score/max) and clamps Punkte entries to 0–15 */
export function normalizeGradeEntries(raw: unknown): GradeEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((m) => {
      let points: number;
      if (typeof m.points === 'number') {
        points = Math.min(15, Math.max(0, m.points));
      } else {
        const score = typeof m.score === 'number' ? m.score : 0;
        const max = typeof m.max === 'number' ? m.max : 0;
        points = percentToPoints(max > 0 ? (score / max) * 100 : 0);
      }
      return {
        id: String(m.id ?? ''),
        subjectId: typeof m.subjectId === 'string' ? m.subjectId : undefined,
        title: m.title != null ? String(m.title) : '',
        points,
        weight: Number(m.weight ?? 1) || 1,
        date: typeof m.date === 'string' ? m.date : undefined,
      };
    });
}

export interface GradeInput {
  subjectId: string;
  title: string;
  points: number;
  weight: number;
  date?: string;
}

interface GradesState {
  entries: GradeEntry[];
  addEntry: (input: GradeInput) => string;
  updateEntry: (id: string, patch: Partial<Omit<GradeEntry, 'id' | 'subjectId'>>) => void;
  removeEntry: (id: string) => void;
  /** removes every entry belonging to the subject (cascade on subject delete) */
  removeSubject: (subjectId: string) => void;
  clearAll: () => void;
  upsertOne: (entry: GradeEntry) => void;
  removeOne: (id: string) => void;
}

export const useGradesStore = create<GradesState>()(
  persist<GradesState, [], [], Pick<GradesState, 'entries'>>(
    (set, get) => ({
      entries: [],
      addEntry: (input) => {
        const entry: GradeEntry = {
          id: uid(),
          subjectId: input.subjectId,
          title: input.title.trim(),
          points: input.points,
          weight: input.weight,
          date: input.date,
        };
        set((s) => ({ entries: [...s.entries, entry] }));
        return entry.id;
      },
      updateEntry: (id, patch) =>
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== id) return e;
            const title = patch.title != null && patch.title.trim() !== '' ? patch.title.trim() : e.title;
            return {
              ...e,
              title,
              points: patch.points ?? e.points,
              weight: patch.weight ?? e.weight,
              date: patch.date === undefined ? e.date : patch.date,
            };
          }),
        })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      removeSubject: (subjectId) =>
        set((s) => ({ entries: s.entries.filter((e) => e.subjectId !== subjectId) })),
      clearAll: () => set({ entries: [] }),
      upsertOne: (entry) =>
        set((s) => {
          const next = [...s.entries];
          const i = next.findIndex((x) => x.id === entry.id);
          if (i >= 0) next[i] = entry;
          else next.push(entry);
          return { entries: next };
        }),
      removeOne: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
    }),
    {
      name: 'semester.grades',
      version: 2,
      storage: appStorage,
      partialize: (s: GradesState) => ({ entries: s.entries.map(gradeEntryToJson) }),
      merge: safeMerge((persisted: any, current: GradesState) => {
        // v1 stored score/max entries — normalizeGradeEntries converts them
        return { ...current, entries: normalizeGradeEntries((persisted as { entries?: unknown }).entries) };
      }),
    } as unknown as PersistOptions<GradesState, Pick<GradesState, 'entries'>>,
  ),
);
