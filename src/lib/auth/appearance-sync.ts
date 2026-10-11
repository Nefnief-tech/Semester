"use client";

import { account } from "./appwrite";
import { useAuthStore } from "@/lib/store/auth";
import { useSettingsStore } from "@/lib/store/settings";
import {
  applyAppearance,
  type AccentId,
  type AppearancePrefs,
  type DesignId,
} from "@/lib/appearance";

/**
 * Opt-in sync of the appearance slice (design, accent, corners, grid,
 * motion) through the Appwrite account prefs — no extra table, the prefs
 * travel with the account. Local storage stays the working copy: the
 * appearance applies instantly either way, the cloud only mirrors it.
 *
 * Conflict rule: on sign-in the remote wins when it carries an appearance
 * blob; otherwise the local look is pushed up. While the toggle is on,
 * every local change pushes (debounced).
 */

const DESIGNS: DesignId[] = ["papier", "klar", "tinte", "konsole"];
const ACCENTS: AccentId[] = ["green", "blue", "brick", "violet", "teal", "gold"];

/** remote prefs are untrusted — whitelist every field, fall back per field */
function parseAppearance(value: unknown): AppearancePrefs | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
    allowed.includes(v as T) ? (v as T) : null;
  const design = pick(o.design, DESIGNS);
  const accent = pick(o.accent, ACCENTS);
  const corners = pick(o.corners, ["normal", "sharp", "round"] as const);
  const grid = pick(o.grid, ["dots", "lines", "none"] as const);
  const motion = pick(o.motion, ["normal", "quiet"] as const);
  if (design === null && accent === null && corners === null && grid === null && motion === null) {
    return null;
  }
  const s = useSettingsStore.getState();
  return {
    design: design ?? s.design,
    accent: accent ?? s.accent,
    corners: corners ?? s.corners,
    grid: grid ?? s.grid,
    motion: motion ?? s.motion,
  };
}

function signedIn(): boolean {
  return useAuthStore.getState().status === "signed-in";
}

/**
 * pushes the current local appearance into the account prefs. With the
 * toggle off this actively strips the blob instead — its absence in the
 * cloud is what tells a fresh device "no look synced".
 */
export async function pushAppearance(): Promise<void> {
  if (!account || !signedIn()) return;
  const s = useSettingsStore.getState();
  const prefs = (await account.getPrefs().catch(() => ({}))) as Record<string, unknown>;
  if (!s.syncAppearance) {
    if (prefs.appearance === undefined || prefs.appearance === null) return;
    await account.updatePrefs({ ...prefs, appearance: null });
    return;
  }
  const appearance: AppearancePrefs = {
    design: s.design,
    accent: s.accent,
    corners: s.corners,
    grid: s.grid,
    motion: s.motion,
  };
  await account.updatePrefs({ ...prefs, appearance });
}

let applyingRemote = false;

/**
 * pulls the account's appearance and applies it. Runs on every sign-in —
 * regardless of the local flag, because a wiped device has no flag: the
 * blob's presence in the cloud is the consent. Absent blob + local flag
 * on (stale) → push the local look up.
 */
export async function reconcileAppearance(): Promise<void> {
  if (!account || !signedIn()) return;
  const s = useSettingsStore.getState();
  try {
    const prefs = (await account.getPrefs()) as Record<string, unknown>;
    const remote = parseAppearance(prefs.appearance);
    if (remote) {
      applyingRemote = true;
      try {
        s.setDesign(remote.design);
        s.setAccent(remote.accent);
        s.setCorners(remote.corners);
        s.setGrid(remote.grid);
        s.setMotion(remote.motion);
        if (!s.syncAppearance) s.setSyncAppearance(true);
      } finally {
        applyingRemote = false;
      }
      applyAppearance(remote);
    } else if (s.syncAppearance) {
      await pushAppearance();
    }
  } catch (e) {
    console.warn("[appearance] sync failed:", e);
  }
}

/* ---------------- live push while enabled ---------------- */

const PUSH_DEBOUNCE_MS = 800;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let subscribed = false;

/** the appearance fields that trigger a push (syncAppearance handled by the UI) */
function appearanceChanged(a: AppearancePrefs, b: AppearancePrefs): boolean {
  return (
    a.design !== b.design ||
    a.accent !== b.accent ||
    a.corners !== b.corners ||
    a.grid !== b.grid ||
    a.motion !== b.motion
  );
}

function slice(s: ReturnType<typeof useSettingsStore.getState>): AppearancePrefs {
  return { design: s.design, accent: s.accent, corners: s.corners, grid: s.grid, motion: s.motion };
}

/** subscribe once per session: local appearance changes push while enabled */
export function subscribeAppearanceSync(): void {
  if (subscribed) return;
  subscribed = true;
  useSettingsStore.subscribe((state, prev) => {
    if (applyingRemote || !state.syncAppearance) return;
    if (!appearanceChanged(slice(state), slice(prev))) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      void pushAppearance().catch((e) => console.warn("[appearance] push failed:", e));
    }, PUSH_DEBOUNCE_MS);
  });
}
