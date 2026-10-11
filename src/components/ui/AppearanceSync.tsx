"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/store/settings";
import { applyAppearance } from "@/lib/appearance";

/**
 * Mirrors the appearance settings (design, accent, corners, grid, motion)
 * from the settings store onto <html> as data attributes. The pre-paint
 * inline script in layout.tsx already applied the persisted values — this
 * keeps them live when a choice changes mid-session. Mounted only inside
 * the app shell, so the marketing landing and the docs page keep their
 * own fixed look.
 */
export default function AppearanceSync() {
  useEffect(() => {
    const s = useSettingsStore.getState();
    applyAppearance(s);
    return useSettingsStore.subscribe((state) => applyAppearance(state));
  }, []);
  return null;
}
