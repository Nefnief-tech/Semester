"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { isDarkMode, onModeChange, setDarkMode } from "@/lib/appearance";

/**
 * light/dark toggle — the initial class is applied by the inline script in
 * layout.tsx; switching goes through setDarkMode so every toggle and the
 * appearance settings stay in sync via the MODE_CHANGED event.
 */
export default function ThemeToggle() {
  const dark = useSyncExternalStore(onModeChange, isDarkMode, () => false);

  return (
    <button
      onClick={() => setDarkMode(!dark)}
      className="btn-icon"
      aria-label="Toggle dark mode"
      title="Toggle theme"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
