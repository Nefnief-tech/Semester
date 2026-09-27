/* Port of `lib/stores/events_store.dart`. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import { EventType, StudyEvent, studyEventFromJson, studyEventToJson } from '../models/types';
import { uid } from '../utils/utils';
import { appStorage, persist, safeMerge } from './base';

export interface EventInput {
  title: string;
  date: string;
  time?: string;
  type: EventType;
  subjectId?: string;
  notes?: string;
}

export interface EventPatch {
  title?: string;
  date?: string;
  time?: string | null;
  type?: EventType;
  subjectId?: string | null;
  notes?: string | null;
}

interface EventsState {
  events: StudyEvent[];
  addEvent: (input: EventInput) => string;
  updateEvent: (id: string, patch: EventPatch) => void;
  removeEvent: (id: string) => void;
  detachSubject: (subjectId: string) => void;
  clearAll: () => void;
  upsertOne: (event: StudyEvent) => void;
  removeOne: (id: string) => void;
}

export const useEventsStore = create<EventsState>()(
  persist<EventsState, [], [], Pick<EventsState, 'events'>>(
    (set, get) => ({
      events: [],
      addEvent: (input) => {
        const event: StudyEvent = {
          id: uid(),
          title: input.title.trim(),
          date: input.date,
          time: input.time,
          type: input.type,
          subjectId: input.subjectId,
          notes: input.notes,
        };
        set((s) => ({ events: [...s.events, event] }));
        return event.id;
      },
      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) => {
            if (e.id !== id) return e;
            const title = patch.title != null && patch.title.trim() !== '' ? patch.title.trim() : e.title;
            return {
              ...e,
              title,
              date: patch.date ?? e.date,
              time: patch.time === null ? undefined : (patch.time ?? e.time),
              type: patch.type ?? e.type,
              subjectId: patch.subjectId === null ? undefined : (patch.subjectId ?? e.subjectId),
              notes: patch.notes === null ? undefined : (patch.notes ?? e.notes),
            };
          }),
        })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      detachSubject: (subjectId) =>
        set((s) => ({
          events: s.events.map((e) => (e.subjectId === subjectId ? { ...e, subjectId: undefined } : e)),
        })),
      clearAll: () => set({ events: [] }),
      upsertOne: (event) =>
        set((s) => {
          const next = [...s.events];
          const i = next.findIndex((x) => x.id === event.id);
          if (i >= 0) next[i] = event;
          else next.push(event);
          return { events: next };
        }),
      removeOne: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
    }),
    {
      name: 'semester.events',
      version: 1,
      storage: appStorage,
      partialize: (s: EventsState) => ({ events: s.events.map(studyEventToJson) }),
      merge: safeMerge((persisted: any, current: EventsState) => {
        const raw = (persisted as { events?: unknown[] }).events ?? [];
        return {
          ...current,
          events: raw
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map(studyEventFromJson),
        };
      }),
    } as unknown as PersistOptions<EventsState, Pick<EventsState, 'events'>>,
  ),
);
