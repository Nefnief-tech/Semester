"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * DSGVO consent for storage and external services. Everything Semester saves
 * by default is strictly necessary (local-first data, theme, language) — the
 * only consentable category is "external" (third-party services such as
 * Spotify). The decision lives on the device and can be changed any time
 * from /privacy, which simply reopens the banner.
 */

interface ConsentState {
  /** false until the visitor made a choice — the banner stays visible */
  decided: boolean;
  /** allow loading third-party services (Spotify embeds, …) */
  external: boolean;
  decidedAt: number | null;
  decide: (external: boolean) => void;
  /** forget the decision so the banner asks again */
  reset: () => void;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      decided: false,
      external: false,
      decidedAt: null,
      decide: (external) => set({ decided: true, external, decidedAt: Date.now() }),
      reset: () => set({ decided: false, external: false, decidedAt: null }),
    }),
    { name: "semester.consent", version: 1 },
  ),
);

/** forget the decision — used by /privacy to reopen the banner */
export const resetConsent = () => useConsentStore.getState().reset();
