/**
 * Appearance catalogs for the design-language system — the single source the
 * settings UI reads and the CSS in globals.css mirrors as `[data-dl]` /
 * `[data-accent]` rules. Mode (light/dark) keeps its own pre-paint mechanism
 * via the `.dark` class and the `semester.theme` localStorage key.
 */

export type DesignId = "papier" | "klar" | "tinte" | "konsole";
export type AccentId = "green" | "blue" | "brick" | "violet" | "teal" | "gold";

export interface DesignDef {
  id: DesignId;
  /** proper noun — intentionally not translated */
  name: string;
  /** i18n key: one line on what the language feels like */
  tagline: string;
  /** light-mode snapshot for the preview tiles in the settings */
  preview: {
    paper: string;
    card: string;
    ink: string;
    soft: string;
    line: string;
    display: string;
    body: string;
    radius: string;
    pill: string;
  };
}

export const DESIGNS: DesignDef[] = [
  {
    id: "papier",
    name: "Papier",
    tagline: "Warm paper, serif headlines, soft pill buttons",
    preview: {
      paper: "#f5f2ea",
      card: "#fdfcf8",
      ink: "#26221b",
      soft: "#756e60",
      line: "#e0dacb",
      display: "var(--font-fraunces)",
      body: "var(--font-instrument)",
      radius: "12px",
      pill: "999px",
    },
  },
  {
    id: "klar",
    name: "Klar",
    tagline: "Cool and reduced — sans-serif, quiet surfaces",
    preview: {
      paper: "#f6f7f9",
      card: "#ffffff",
      ink: "#1b202a",
      soft: "#69737f",
      line: "#e3e7ed",
      display: "var(--font-instrument)",
      body: "var(--font-instrument)",
      radius: "10px",
      pill: "6px",
    },
  },
  {
    id: "tinte",
    name: "Tinte",
    tagline: "High-contrast ink, sharp edges, editorial",
    preview: {
      paper: "#f3f2ed",
      card: "#fffefb",
      ink: "#16140f",
      soft: "#6e6a5f",
      line: "#d8d4c6",
      display: "var(--font-fraunces)",
      body: "var(--font-instrument)",
      radius: "3px",
      pill: "3px",
    },
  },
  {
    id: "konsole",
    name: "Konsole",
    tagline: "Everything in monospace, like a terminal",
    preview: {
      paper: "#f2f4ec",
      card: "#fafbf4",
      ink: "#232a1e",
      soft: "#75806a",
      line: "#dce1cf",
      display: "var(--font-plex)",
      body: "var(--font-plex)",
      radius: "5px",
      pill: "4px",
    },
  },
];

export interface AccentDef {
  id: AccentId;
  /** i18n key */
  name: string;
  /** light-mode accent for the swatch (the CSS handles dark) */
  light: string;
}

export const ACCENTS: AccentDef[] = [
  { id: "green", name: "Green", light: "#31633f" },
  { id: "blue", name: "Blue", light: "#2f5d8a" },
  { id: "brick", name: "Brick", light: "#a1442f" },
  { id: "violet", name: "Violet", light: "#6b4d9e" },
  { id: "teal", name: "Teal", light: "#1f6f6a" },
  { id: "gold", name: "Gold", light: "#8f6b0e" },
];

export const DEFAULT_DESIGN: DesignId = "papier";
export const DEFAULT_ACCENT: AccentId = "green";

/* ---------------- mode (light/dark) ----------------
   the original ThemeToggle mechanism, extracted so the settings
   page and the topbar toggle stay in sync through MODE_CHANGED. */

const MODE_KEY = "semester.theme";

export const MODE_CHANGED = "semester:mode";

export function isDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function setDarkMode(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(MODE_KEY, dark ? "dark" : "light");
  } catch {
    /* private mode — theme just won't persist */
  }
  window.dispatchEvent(new Event(MODE_CHANGED));
}

export function onModeChange(cb: () => void): () => void {
  window.addEventListener(MODE_CHANGED, cb);
  return () => window.removeEventListener(MODE_CHANGED, cb);
}

/* ---------------- design + accent ---------------- */

/** mirrors the appearance settings onto <html> — the CSS keys off these */
export function applyAppearance(design: DesignId, accent: AccentId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.dl = design;
  document.documentElement.dataset.accent = accent;
}
