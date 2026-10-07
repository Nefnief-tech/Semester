"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Device-level preferences that are not user data and never sync (like theme
 * and language): the Bundesland drives the Ferien/Feiertage calendar, the
 * school year labels the active term and drives the Schuljahreswechsel.
 */

/** "2026/27" for a date — the school year flips on August 1 */
export function schoolYearFor(date = new Date()): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= 7 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

/** "2026/27" → "2027/28" (tolerates other label formats: keeps the last number) */
export function nextSchoolYear(label: string): string {
  const m = label.match(/(\d{4})\s*\/\s*(\d{1,2})/);
  if (!m) return schoolYearFor(new Date(Date.now() + 365 * 86_400_000));
  const start = Number(m[1]) + 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

/** reading preferences for the EPUB reader — device-level like the rest */
export interface ReadingPrefs {
  fontSize: number; // px
  serif: boolean;
  theme: "light" | "sepia" | "dark";
  spacing: number; // line-height
}

export const DEFAULT_READING: ReadingPrefs = {
  fontSize: 110,
  serif: true,
  theme: "sepia",
  spacing: 1.6,
};

interface SettingsState {
  /** "" = not set — no holidays shown */
  bundesland: string;
  schoolYear: string;
  reading: ReadingPrefs;
  setBundesland: (code: string) => void;
  setSchoolYear: (label: string) => void;
  setReading: (patch: Partial<ReadingPrefs>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      bundesland: "",
      schoolYear: schoolYearFor(),
      reading: DEFAULT_READING,
      setBundesland: (bundesland) => set({ bundesland }),
      setSchoolYear: (schoolYear) => set({ schoolYear: schoolYear.trim() }),
      setReading: (patch) => set((s) => ({ reading: { ...s.reading, ...patch } })),
    }),
    { name: "semester.settings", version: 1 },
  ),
);
