"use client";

import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { useConsentStore } from "./store/consent";

/**
 * Storage guard for every persisted store except the consent record itself:
 * reads return nothing and writes are dropped until the visitor made their
 * choice in the consent banner. After the decision, storage passes through
 * unchanged. This guarantees the strict "nothing stored before consent"
 * behavior — not a single semester.* key exists before the banner is answered.
 */

const allowed = () => useConsentStore.getState().decided;

export const gatedStorage: StateStorage = {
  getItem: (name) => (allowed() ? localStorage.getItem(name) : null),
  setItem: (name, value) => {
    if (allowed()) localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (allowed()) localStorage.removeItem(name);
  },
};

export const gatedJSONStorage = () => createJSONStorage(() => gatedStorage);
