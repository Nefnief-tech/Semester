/* Port of `lib/stores/subjects_store.dart`. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import { Subject, subjectFromJson, subjectToJson } from '../models/types';
import { PALETTE, uid } from '../utils/utils';
import { appStorage, persist, safeMerge } from './base';
import { useEventsStore } from './events_store';
import { useGradesStore } from './grades_store';
import { useHomeworkStore } from './homework_store';
import { useTodosStore } from './todos_store';

interface SubjectsState {
  subjects: Subject[];
  addSubject: (name: string, color?: string) => Subject;
  updateSubject: (id: string, patch: { name?: string; color?: string }) => void;
  /** removes the subject and detaches/deletes it everywhere — cascade */
  removeSubject: (id: string) => void;
  clearAll: () => void;
  upsertOne: (subject: Subject) => void;
  removeOne: (id: string) => void;
}

export const useSubjectsStore = create<SubjectsState>()(
  persist<SubjectsState, [], [], Pick<SubjectsState, 'subjects'>>(
    (set, get) => ({
      subjects: [],
      addSubject: (name, color) => {
        const list = get().subjects;
        const subject: Subject = {
          id: uid(),
          name: name.trim(),
          color: color ?? PALETTE[list.length % PALETTE.length],
        };
        set({ subjects: [...list, subject] });
        return subject;
      },
      updateSubject: (id, patch) =>
        set((s) => ({
          subjects: s.subjects.map((sub) =>
            sub.id === id
              ? { ...sub, name: patch.name?.trim() ?? sub.name, color: patch.color ?? sub.color }
              : sub,
          ),
        })),
      removeSubject: (id) => {
        set((s) => ({ subjects: s.subjects.filter((sub) => sub.id !== id) }));
        useTodosStore.getState().detachSubject(id);
        useGradesStore.getState().removeSubject(id);
        useEventsStore.getState().detachSubject(id);
        useHomeworkStore.getState().detachSubject(id);
      },
      clearAll: () => set({ subjects: [] }),
      upsertOne: (subject) =>
        set((s) => {
          const next = [...s.subjects];
          const i = next.findIndex((x) => x.id === subject.id);
          if (i >= 0) next[i] = subject;
          else next.push(subject);
          return { subjects: next };
        }),
      removeOne: (id) => set((s) => ({ subjects: s.subjects.filter((x) => x.id !== id) })),
    }),
    {
      name: 'semester.subjects',
      version: 1,
      storage: appStorage,
      partialize: (s: SubjectsState) => ({ subjects: s.subjects.map(subjectToJson) }),
      merge: safeMerge((persisted: any, current: SubjectsState) => {
        const raw = (persisted as { subjects?: unknown[] }).subjects ?? [];
        return {
          ...current,
          subjects: raw
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map(subjectFromJson),
        };
      }),
    } as unknown as PersistOptions<SubjectsState, Pick<SubjectsState, 'subjects'>>,
  ),
);
