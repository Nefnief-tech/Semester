/* Port of `lib/stores/todos_store.dart`. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import { Priority, Todo, todoFromJson, todoToJson } from '../models/types';
import { uid } from '../utils/utils';
import { appStorage, persist, safeMerge } from './base';

export interface TodoInput {
  title: string;
  notes?: string;
  due?: string;
  priority: Priority;
  subjectId?: string;
}

export interface TodoPatch {
  title?: string;
  notes?: string | null;
  due?: string | null;
  priority?: Priority;
  subjectId?: string | null;
}

interface TodosState {
  todos: Todo[];
  addTodo: (input: TodoInput) => string;
  updateTodo: (id: string, patch: TodoPatch) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  detachSubject: (subjectId: string) => void;
  clearAll: () => void;
  upsertOne: (todo: Todo) => void;
  removeOne: (id: string) => void;
}

export const useTodosStore = create<TodosState>()(
  persist<TodosState, [], [], Pick<TodosState, 'todos'>>(
    (set, get) => ({
      todos: [],
      addTodo: (input) => {
        const todo: Todo = {
          id: uid(),
          title: input.title.trim(),
          notes: input.notes,
          due: input.due,
          priority: input.priority,
          subjectId: input.subjectId,
          done: false,
          createdAt: Date.now(),
        };
        set((s) => ({ todos: [todo, ...s.todos] }));
        return todo.id;
      },
      updateTodo: (id, patch) =>
        set((s) => ({
          todos: s.todos.map((t) => {
            if (t.id !== id) return t;
            const title = patch.title != null && patch.title.trim() !== '' ? patch.title.trim() : t.title;
            return {
              ...t,
              title,
              notes: patch.notes === null ? undefined : (patch.notes ?? t.notes),
              due: patch.due === null ? undefined : (patch.due ?? t.due),
              priority: patch.priority ?? t.priority,
              subjectId: patch.subjectId === null ? undefined : (patch.subjectId ?? t.subjectId),
            };
          }),
        })),
      toggleTodo: (id) =>
        set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      removeTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
      detachSubject: (subjectId) =>
        set((s) => ({
          todos: s.todos.map((t) => (t.subjectId === subjectId ? { ...t, subjectId: undefined } : t)),
        })),
      clearAll: () => set({ todos: [] }),
      upsertOne: (todo) =>
        set((s) => {
          const next = [...s.todos];
          const i = next.findIndex((x) => x.id === todo.id);
          if (i >= 0) next[i] = todo;
          else next.unshift(todo);
          return { todos: next };
        }),
      removeOne: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
    }),
    {
      name: 'semester.todos',
      version: 1,
      storage: appStorage,
      partialize: (s: TodosState) => ({ todos: s.todos.map(todoToJson) }),
      merge: safeMerge((persisted: any, current: TodosState) => {
        const raw = (persisted as { todos?: unknown[] }).todos ?? [];
        return {
          ...current,
          todos: raw
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map(todoFromJson),
        };
      }),
    } as unknown as PersistOptions<TodosState, Pick<TodosState, 'todos'>>,
  ),
);
