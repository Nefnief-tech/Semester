/* Port of `lib/stores/homework_store.dart`. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import { Homework, homeworkFromJson, homeworkToJson, Priority } from '../models/types';
import { uid } from '../utils/utils';
import { appStorage, persist, safeMerge } from './base';

export interface HomeworkInput {
  title: string;
  subjectId?: string;
  due?: string;
  priority: Priority;
  notes?: string;
}

export interface HomeworkPatch {
  title?: string;
  notes?: string | null;
  due?: string | null;
  priority?: Priority;
  subjectId?: string | null;
}

interface HomeworkState {
  homeworks: Homework[];
  addHomework: (input: HomeworkInput) => string;
  updateHomework: (id: string, patch: HomeworkPatch) => void;
  toggleHomework: (id: string) => void;
  removeHomework: (id: string) => void;
  detachSubject: (subjectId: string) => void;
  clearAll: () => void;
  upsertOne: (homework: Homework) => void;
  removeOne: (id: string) => void;
}

export const useHomeworkStore = create<HomeworkState>()(
  persist<HomeworkState, [], [], Pick<HomeworkState, 'homeworks'>>(
    (set, get) => ({
      homeworks: [],
      addHomework: (input) => {
        const homework: Homework = {
          id: uid(),
          title: input.title.trim(),
          subjectId: input.subjectId,
          due: input.due,
          priority: input.priority,
          notes: input.notes,
          done: false,
          createdAt: Date.now(),
        };
        set((s) => ({ homeworks: [homework, ...s.homeworks] }));
        return homework.id;
      },
      updateHomework: (id, patch) =>
        set((s) => ({
          homeworks: s.homeworks.map((h) => {
            if (h.id !== id) return h;
            const title = patch.title != null && patch.title.trim() !== '' ? patch.title.trim() : h.title;
            return {
              ...h,
              title,
              notes: patch.notes === null ? undefined : (patch.notes ?? h.notes),
              due: patch.due === null ? undefined : (patch.due ?? h.due),
              priority: patch.priority ?? h.priority,
              subjectId: patch.subjectId === null ? undefined : (patch.subjectId ?? h.subjectId),
            };
          }),
        })),
      toggleHomework: (id) =>
        set((s) => ({
          homeworks: s.homeworks.map((h) => (h.id === id ? { ...h, done: !h.done } : h)),
        })),
      removeHomework: (id) => set((s) => ({ homeworks: s.homeworks.filter((h) => h.id !== id) })),
      detachSubject: (subjectId) =>
        set((s) => ({
          homeworks: s.homeworks.map((h) =>
            h.subjectId === subjectId ? { ...h, subjectId: undefined } : h,
          ),
        })),
      clearAll: () => set({ homeworks: [] }),
      upsertOne: (homework) =>
        set((s) => {
          const next = [...s.homeworks];
          const i = next.findIndex((x) => x.id === homework.id);
          if (i >= 0) next[i] = homework;
          else next.unshift(homework);
          return { homeworks: next };
        }),
      removeOne: (id) => set((s) => ({ homeworks: s.homeworks.filter((h) => h.id !== id) })),
    }),
    {
      name: 'semester.homework',
      version: 1,
      storage: appStorage,
      partialize: (s: HomeworkState) => ({ homeworks: s.homeworks.map(homeworkToJson) }),
      merge: safeMerge((persisted: any, current: HomeworkState) => {
        const raw = (persisted as { homeworks?: unknown[] }).homeworks ?? [];
        return {
          ...current,
          homeworks: raw
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map(homeworkFromJson),
        };
      }),
    } as unknown as PersistOptions<HomeworkState, Pick<HomeworkState, 'homeworks'>>,
  ),
);
