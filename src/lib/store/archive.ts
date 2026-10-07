"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GradeEntry, Homework, StudyEvent, Todo } from "../types";

/**
 * School-year archives, kept locally on each device (the cloud syncs the
 * active data; a finished year's snapshot would need a new Appwrite table,
 * so the Schuljahreswechsel pairs the local archive with a downloaded JSON
 * backup as the portable copy).
 */

export interface YearArchive {
  id: string;
  /** e.g. "2025/26" */
  label: string;
  archivedAt: number;
  grades: GradeEntry[];
  homework: Homework[];
  events: StudyEvent[];
  todos: Todo[];
}

interface ArchiveState {
  archives: YearArchive[];
  addArchive: (archive: YearArchive) => void;
  removeArchive: (id: string) => void;
}

export const useArchiveStore = create<ArchiveState>()(
  persist(
    (set) => ({
      archives: [],
      addArchive: (archive) =>
        set((s) => ({ archives: [...s.archives.filter((a) => a.id !== archive.id), archive] })),
      removeArchive: (id) =>
        set((s) => ({ archives: s.archives.filter((a) => a.id !== id) })),
    }),
    { name: "semester.archive", version: 1 },
  ),
);
