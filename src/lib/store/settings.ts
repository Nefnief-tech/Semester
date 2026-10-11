"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { gatedJSONStorage } from "../storage-guard";
import {
  DEFAULT_ACCENT,
  DEFAULT_DESIGN,
  type AccentId,
  type Corners,
  type DesignId,
  type GridPattern,
  type MotionPref,
} from "../appearance";

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
  /** design language (Papier/Klar/Tinte/Konsole) — see lib/appearance.ts */
  design: DesignId;
  /** accent color layered on top of any design language */
  accent: AccentId;
  /** corner preference — "normal" follows the design language */
  corners: Corners;
  /** background pattern of the content canvas */
  grid: GridPattern;
  /** "quiet" = no entrance animations, no transitions */
  motion: MotionPref;
  /** opt-in: mirror the appearance slice into the Appwrite account prefs */
  syncAppearance: boolean;
  setBundesland: (code: string) => void;
  setSchoolYear: (label: string) => void;
  setReading: (patch: Partial<ReadingPrefs>) => void;
  setDesign: (design: DesignId) => void;
  setAccent: (accent: AccentId) => void;
  setCorners: (corners: Corners) => void;
  setGrid: (grid: GridPattern) => void;
  setMotion: (motion: MotionPref) => void;
  setSyncAppearance: (sync: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      bundesland: "",
      schoolYear: schoolYearFor(),
      reading: DEFAULT_READING,
      design: DEFAULT_DESIGN,
      accent: DEFAULT_ACCENT,
      corners: "normal",
      grid: "dots",
      motion: "normal",
      syncAppearance: false,
      setBundesland: (bundesland) => set({ bundesland }),
      setSchoolYear: (schoolYear) => set({ schoolYear: schoolYear.trim() }),
      setReading: (patch) => set((s) => ({ reading: { ...s.reading, ...patch } })),
      setDesign: (design) => set({ design }),
      setAccent: (accent) => set({ accent }),
      setCorners: (corners) => set({ corners }),
      setGrid: (grid) => set({ grid }),
      setMotion: (motion) => set({ motion }),
      setSyncAppearance: (syncAppearance) => set({ syncAppearance }),
    }),
    { storage: gatedJSONStorage(), name: "semester.settings", version: 1 },
  ),
);
