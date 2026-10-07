"use client";

import { useLangStore } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** DE / EN pill toggle — German is the default; English keys are the source strings */
export default function LangToggle() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  return (
    <div
      className="flex items-center rounded-full border border-line bg-card p-0.5"
      role="group"
      aria-label="Language / Sprache"
    >
      {(["de", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            "cursor-pointer rounded-full px-2 py-0.5 font-mono text-[10px] uppercase transition-colors",
            lang === l ? "bg-accent text-paper" : "text-ink-soft hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
